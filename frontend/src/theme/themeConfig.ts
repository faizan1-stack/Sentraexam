import type { ThemeConfig } from 'antd';
import { theme as antdTheme } from 'antd';

import type { ThemeMode } from '../contexts/ThemeContext';

const baseComponents: ThemeConfig['components'] = {
  Button: {
    fontFamily: "'Inter', sans-serif",
    fontWeight: 600,
    controlHeight: 40,
    borderRadius: 14,
  },
  Typography: {
    fontFamily: "'Montserrat', sans-serif",
    fontFamilyCode: "'Fira Code', monospace",
  },
  Card: {
    borderRadius: 16,
  },
  Layout: {
    headerBg: '#ffffff',
    siderBg: '#0C2C55',
  },
  Menu: {
    darkItemBg: 'transparent',
  },
  Input: {
    controlHeight: 40,
  },
  Select: {
    controlHeight: 40,
  },
};

export const getThemeConfig = (mode: ThemeMode): ThemeConfig => {
  const isDark = mode === 'dark';

  return {
    algorithm: isDark ? antdTheme.darkAlgorithm : antdTheme.defaultAlgorithm,
    token: {
      fontSize: 14,
      // Brand colors (Campus Blue palette)
      colorPrimary: isDark ? '#629FAD' : '#0C2C55',
      colorInfo: isDark ? '#629FAD' : '#0C2C55',
      fontFamily: "'Inter', sans-serif",
      borderRadius: 14,
      wireframe: false,
      // Backgrounds
      colorBgLayout: isDark ? '#061426' : '#EDEDCE',
      colorBgContainer: isDark ? '#081b33' : '#ffffff',
      colorBgElevated: isDark ? '#0b2342' : '#ffffff',
    },
    components: {
      ...baseComponents,
      Layout: {
        ...baseComponents.Layout,
        headerBg: isDark ? '#081b33' : '#ffffff',
        siderBg: isDark ? '#061426' : '#0C2C55',
      },
    },
  };
};
