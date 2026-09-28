import { Text } from '@hopium/ui';
import { Fragment } from 'react';
import { View } from 'react-native';

/** Renders inline **bold** spans. */
function Inline({ text }: { text: string }) {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return (
    <>
      {parts.map((p, i) =>
        p.startsWith('**') && p.endsWith('**') ? (
          <Text key={i} weight="semibold" tone="inherit">
            {p.slice(2, -2)}
          </Text>
        ) : (
          <Fragment key={i}>{p.replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')}</Fragment>
        ),
      )}
    </>
  );
}

/** Minimal markdown for legal documents: headings, paragraphs, lists, bold. */
export function Markdown({ source }: { source: string }) {
  const blocks = source.trim().split(/\n{2,}/);
  return (
    <View className="gap-3">
      {blocks.map((block, i) => {
        const trimmed = block.trim();
        if (trimmed.startsWith('### '))
          return (
            <Text key={i} variant="h3">
              {trimmed.slice(4)}
            </Text>
          );
        if (trimmed.startsWith('## '))
          return (
            <Text key={i} variant="h2" className="mt-2">
              {trimmed.slice(3)}
            </Text>
          );
        if (trimmed.startsWith('# '))
          return (
            <Text key={i} variant="h1">
              {trimmed.slice(2)}
            </Text>
          );
        if (trimmed.startsWith('> ')) {
          return (
            <View key={i} className="border-warning/50 bg-warning/10 rounded-md border p-3">
              <Text weight="semibold">
                <Inline text={trimmed.replace(/^>\s?/gm, '')} />
              </Text>
            </View>
          );
        }
        if (/^[-*] /.test(trimmed)) {
          return (
            <View key={i} className="gap-1.5">
              {trimmed.split('\n').map((line, j) => (
                <View key={j} className="flex-row gap-2">
                  <Text tone="muted">•</Text>
                  <Text className="flex-1">
                    <Inline text={line.replace(/^[-*]\s/, '')} />
                  </Text>
                </View>
              ))}
            </View>
          );
        }
        return (
          <Text key={i}>
            <Inline text={trimmed.replace(/\n/g, ' ')} />
          </Text>
        );
      })}
    </View>
  );
}
