import Head from 'expo-router/head';
import { Platform } from 'react-native';

const SITE = 'https://hopium.family';

/** Per-route <title>, description and Open Graph tags (web). */
export function Seo({
  title,
  description,
  path,
  image,
}: {
  title: string;
  description?: string;
  path?: string;
  image?: string;
}) {
  if (Platform.OS !== 'web') return null;
  const url = `${SITE}${path ?? ''}`;
  const img = image ?? `${SITE}/og-image.png`;
  return (
    <Head>
      <title>{title}</title>
      {description ? <meta name="description" content={description} /> : null}
      <meta property="og:title" content={title} />
      {description ? <meta property="og:description" content={description} /> : null}
      <meta property="og:url" content={url} />
      <meta property="og:image" content={img} />
      <meta property="og:type" content="website" />
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:title" content={title} />
      <meta name="twitter:image" content={img} />
    </Head>
  );
}
