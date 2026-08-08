"use client";

import { useTheme } from "next-themes";
import { useEffect, useState } from "react";

export function useThemeSync() {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- Required to avoid SSR hydration mismatch with next-themes
    setMounted(true);
  }, []);

  return {
    theme,
    setTheme,
    mounted,
  };
}
