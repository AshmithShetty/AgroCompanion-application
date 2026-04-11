import React, { useState, useEffect } from 'react';
import { Text } from 'react-native';
import { theme } from '../../theme/index';
import { useTranslation } from 'react-i18next';
import { AppTranslator } from '../../services/ai/TranslationEngine';

export const CustomText = ({ children, variant = 'body', style, color, ...props }) => {
  const { i18n } = useTranslation();
  const [displayText, setDisplayText] = useState(children);

  useEffect(() => {
    let isMounted = true;
    const currentLang = i18n.language;

    const hasEnglishLetters = (str) => typeof str === 'string' && /[a-zA-Z]/.test(str);

    const run = async () => {
      if (!children) {
        if (isMounted) setDisplayText(children);
        return;
      }

      const shouldTranslate = (text) => props.dynamic || (currentLang !== 'en' && hasEnglishLetters(text));

      if (Array.isArray(children)) {
        const translationPromises = children.map(child => {
          if (shouldTranslate(child)) {
            return new Promise(resolve => AppTranslator.translate(child, currentLang, resolve));
          }
          return Promise.resolve(child);
        });

        const translatedArray = await Promise.all(translationPromises);
        if (isMounted) setDisplayText(translatedArray);
        return;
      }

      if (shouldTranslate(children)) {
        AppTranslator.translate(children, currentLang, (translated) => {
          if (isMounted) setDisplayText(translated);
        });
        return;
      }

      if (isMounted) setDisplayText(children);
    };

    run();
    return () => { isMounted = false; };
  }, [children, i18n.language, props.dynamic]);
  const getFontFamily = () => {
    const isHeading = ['display', 'h1', 'h2', 'heading', 'subheading'].includes(variant);
    const family = isHeading ? 'Poppins' : 'Inter';
    
    if (variant === 'display' || variant === 'h1' || variant === 'h2' || variant === 'heading') return `${family}-Bold`;
    if (variant === 'subheading') return `${family}-SemiBold`;
    if (variant === 'caption' || variant === 'overline') return `${family}-Medium`;
    return family; 
  };

  const typographyConfig = theme?.typography?.[variant] || theme?.typography?.body || { fontSize: 14 };
  const fontSize = typographyConfig.fontSize || 14;
  const finalColor = color || theme?.colors?.text || '#1A1A1A';

  return (
    <Text style={[{ fontFamily: getFontFamily(), fontSize, color: finalColor }, style]} {...props}>
      {displayText}
    </Text>
  );
};
