import { Font } from '@react-pdf/renderer';

/**
 * Register Japanese fonts for @react-pdf/renderer.
 * This is required to display Japanese characters correctly in PDFs.
 * We use Noto Sans JP as the standard font.
 */
export function registerFonts(): void {
  Font.register({
    family: 'Noto Sans JP',
    fonts: [
      {
        src: 'https://fonts.gstatic.com/s/notosansjp/v52/-KyWJ7at6vp6JmKGzjgId6_YqIou_rI.ttf', // Light
        fontWeight: 300,
      },
      {
        src: 'https://fonts.gstatic.com/s/notosansjp/v52/-KyWJ7at6vp6JmKGzjgId6_YpIou_rI.ttf', // Regular
        fontWeight: 400,
      },
      {
        src: 'https://fonts.gstatic.com/s/notosansjp/v52/-KyWJ7at6vp6JmKGzjgId6_YpYou_rI.ttf', // Medium
        fontWeight: 500,
      },
      {
        src: 'https://fonts.gstatic.com/s/notosansjp/v52/-KyWJ7at6vp6JmKGzjgId6_Yqyou_rI.ttf', // Bold
        fontWeight: 700,
      },
    ],
  });
}

/**
 * Standard styles for PDF components to ensure font usage
 */
export const pdfStyles = {
  container: {
    fontFamily: 'Noto Sans JP',
  },
};
