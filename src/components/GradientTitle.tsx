import React, { useMemo } from 'react';
import { Platform, StyleSheet, Text, TextProps, TextStyle, View } from 'react-native';
import MaskedView from '@react-native-masked-view/masked-view';
import { LinearGradient } from 'expo-linear-gradient';

import { theme } from '../styles/theme';

type GradientTitleProps = {
  text: string;
  style?: TextProps['style'];
  numberOfLines?: number;
  ellipsizeMode?: TextProps['ellipsizeMode'];
};

export const GradientTitle: React.FC<GradientTitleProps> = ({
  text,
  style,
  numberOfLines = 1,
  ellipsizeMode = 'tail',
}) => {
  const effectiveStyle = useMemo<TextStyle>(() => {
    const flattened = StyleSheet.flatten([styles.text, style]) as TextStyle | undefined;
    const computed: TextStyle = { ...(flattened ?? {}) };
    const fallbackFontSize =
      typeof computed.fontSize === 'number' ? computed.fontSize : theme.header.title.fontSize;
    if (computed.lineHeight == null && typeof fallbackFontSize === 'number') {
      computed.lineHeight = Math.round(fallbackFontSize * 1.1);
    }
    return computed;
  }, [style]);

  if (Platform.OS === 'web') {
    const webGradientStyle: any = {
      backgroundImage: 'linear-gradient(90deg, #2563eb, #7e22ce)',
      WebkitBackgroundClip: 'text',
      backgroundClip: 'text',
      color: 'transparent',
      WebkitTextFillColor: 'transparent',
      display: 'inline-block',
    };

    return (
      <Text
        numberOfLines={numberOfLines}
        ellipsizeMode={ellipsizeMode}
        accessible={false}
        importantForAccessibility="no"
        style={[effectiveStyle, webGradientStyle]}
      >
        {text}
      </Text>
    );
  }

  return (
    <MaskedView
      style={styles.maskContainer}
      maskElement={
        <View style={styles.maskWrapper}>
          <Text
            numberOfLines={numberOfLines}
            ellipsizeMode={ellipsizeMode}
            accessible={false}
            importantForAccessibility="no"
            style={[effectiveStyle, styles.maskText]}
          >
            {text}
          </Text>
        </View>
      }
    >
      <LinearGradient
        colors={["#2563eb", "#7e22ce"]}
        start={{ x: 0, y: 0.5 }}
        end={{ x: 1, y: 0.5 }}
        style={styles.gradientFill}
      >
        {/** Use an invisible sizing text to ensure gradient matches mask size without drawing behind it */}
        <Text
          accessible={false}
          importantForAccessibility="no"
          numberOfLines={numberOfLines}
          ellipsizeMode={ellipsizeMode}
          style={[effectiveStyle, styles.hiddenText]}
        >
          {text}
        </Text>
      </LinearGradient>
    </MaskedView>
  );
};

const styles = StyleSheet.create({
  text: {
    fontSize: theme.header.title.fontSize,
    fontWeight: theme.header.title.fontWeight,
    letterSpacing: theme.header.title.letterSpacing,
  },
  maskContainer: {
    flexShrink: 1,
  },
  maskWrapper: {
    backgroundColor: 'transparent',
  },
  gradientFill: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  hiddenText: {
    color: 'transparent',
    opacity: 0,
  },
  maskText: {
    // Ensure the mask is fully opaque to reveal the gradient underneath
    color: '#000000',
  },
});

export default GradientTitle;
