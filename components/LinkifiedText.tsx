import React from 'react';
import { Text, StyleSheet, TextStyle } from 'react-native';
import * as WebBrowser from 'expo-web-browser';

const URL_REGEX = /(https?:\/\/[^\s]+)|(www\.[^\s]+)/g;

interface LinkifiedTextProps {
  children: string;
  style?: TextStyle;
  linkStyle?: TextStyle;
  numberOfLines?: number;
}

export default function LinkifiedText({
  children,
  style,
  linkStyle,
  numberOfLines,
}: LinkifiedTextProps) {
  if (!children || typeof children !== 'string') {
    return <Text style={style}>{children}</Text>;
  }

  const parts: { text: string; isLink: boolean }[] = [];
  let lastIndex = 0;

  children.replace(URL_REGEX, (match, _p1, _p2, offset) => {
    if (typeof offset === 'number' && offset > lastIndex) {
      parts.push({ text: children.slice(lastIndex, offset), isLink: false });
    }
    parts.push({ text: match, isLink: true });
    lastIndex = offset + match.length;
    return match;
  });

  if (lastIndex < children.length) {
    parts.push({ text: children.slice(lastIndex), isLink: false });
  }

  const handleOpenUrl = async (rawUrl: string) => {
    const url = rawUrl.startsWith('http') ? rawUrl : `https://${rawUrl}`;
    try {
      await WebBrowser.openBrowserAsync(url);
    } catch (e) {
      console.warn('Failed to open URL', e);
    }
  };

  return (
    <Text style={style} numberOfLines={numberOfLines}>
      {parts.map((part, idx) =>
        part.isLink ? (
          <Text
            key={`link-${idx}`}
            style={[style, styles.link, linkStyle]}
            onPress={() => handleOpenUrl(part.text)}
          >
            {part.text}
          </Text>
        ) : (
          <Text key={`text-${idx}`} style={style}>{part.text}</Text>
        )
      )}
    </Text>
  );
}

const styles = StyleSheet.create({
  link: {
    color: '#1877F2',
    textDecorationLine: 'underline',
  },
});
