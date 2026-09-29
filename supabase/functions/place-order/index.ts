import { handler, json } from '../_shared/http.ts';
import { assertFeature } from '../_shared/compliance.ts';
import { adminClient, rateLimit, requireUser } from '../_shared/supabase.ts';
import { AppError } from '@hopium/core/errors';
import { mul, round } from '@hopium/core/money';
import { placeOrderSchema, validateQuote } from './logic.ts';

/**
 * Two-phase order endpoint:
 *  1. { quote, ... } → validate region/KYC/min order/balance, record pending order.
 *  2. { orderId, status } → finalize after the wallet broadcast; filled orders
 *     insert a trade (triggers maintain holdings, posts and notifications).
 */
Deno.serve(
  handler(async (req) => {
    const admin = adminClient();
    const user = await requireUser(req, admin);
    await rateLimit(admin, user.id, 'place-order');
    const input = placeOrderSchema.parse(await req.json());

    if ('quote' in input) {
      const { quote } = input;
      if (quote.assetClass === 'stock_token') await assertFeature(admin, user.id, 'stock_tokens');
      if (input.copiedFromTradeId) await assertFeature(admin, user.id, 'copy_trade');
      const { data: holding } = await admin.from('holdings').select('qty').eq('user_id', user.id).eq('asset_id', quote.assetId).maybeSingle();
      const { data: cash } = await admin.from('holdings').select('qty').eq('user_id', user.id).eq('asset_id', 'usdc').maybeSingle();
      validateQuote(quote, String(cash?.qty ?? '0'), String(holding?.qty ?? '0'));
      const { data: order, error } = await admin
        .from('orders')
        .insert({
          user_id: user.id, asset_id: quote.assetId, class: quote.assetClass, side: quote.side, type: 'market',
          amount_in: quote.side === 'buy' ? quote.notionalUsd : quote.qty, price: quote.price, fee: quote.platformFeeUsd,
          slippage_bps: quote.slippageBps, status: 'pending', copied_from_trade_id: input.copiedFromTradeId,
        })
        .select('*')
        .single();
      if (error) throw new Error(error.message);
      await admin.from('app_config').select('key').limit(1); // keep connection warm for phase 2
      return json({ order: { ...order, meta: { shareToFeed: input.shareToFeed } } });
    }

    const { data: order } = await admin.from('orders').select('*').eq('id', input.orderId).eq('user_id', user.id).single();
    if (!order || order.status !== 'pending') throw new AppError('not_found', 'Order not found');
    if (input.status === 'failed') {
      await admin.from('orders').update({ status: 'failed', error_code: input.errorCode ?? 'unknown' }).eq('id', order.id);
      return json({ order: { ...order, status: 'failed' }, trade: null, isFirstTrade: false });
    }
    const filled = input.filled ?? { amountIn: String(order.amount_in), amountOut: String(order.amount_out), price: String(order.price) };
    const qty = order.side === 'buy' ? filled.amountOut : filled.amountIn;
    const notional = round(mul(qty, filled.price), 6);
    const { count } = await admin.from('trades').select('id', { count: 'exact', head: true }).eq('user_id', user.id);
    await admin.from('orders').update({ status: 'filled', tx_hash: input.txHash, amount_out: filled.amountOut, price: filled.price }).eq('id', order.id);
    const { data: asset } = await admin.from('assets').select('symbol, class').eq('id', order.asset_id).single();
    const { data: trade, error } = await admin
      .from('trades')
      .insert({
        user_id: user.id, order_id: order.id, asset_id: order.asset_id, symbol: asset?.symbol ?? order.asset_id,
        asset_class: asset?.class ?? 'crypto', side: order.side, qty, price: filled.price, notional, fee: order.fee,
        is_public: true, copied_from_trade_id: order.copied_from_trade_id,
      })
      .select('*')
      .single();
    if (error) throw new Error(error.message);
    if (!count) await admin.from('user_badges').upsert({ user_id: user.id, slug: 'first_trade' });
    await admin.from('activity').insert({ user_id: user.id, kind: 'trade', title: order.side, symbol: trade.symbol, amount_usd: notional, qty, side: order.side, tx_hash: input.txHash });
    return json({ order: { ...order, status: 'filled' }, trade, isFirstTrade: !count });
  }),
);
