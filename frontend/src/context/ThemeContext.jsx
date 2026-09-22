import React, { createContext, useContext, useEffect, useState } from "react";

const ThemeContext = createContext({
  darkMode: true,
  toggleTheme: () => {},
});

export function ThemeProvider({ children }) {
  const [darkMode, setDarkMode] = useState(() => {
    const saved = localStorage.getItem("themis_theme");
    return saved ? saved === "dark" : true; // Default dark
  });

  useEffect(() => {
    const root = document.documentElement;
    if (darkMode) {
      root.classList.add("dark");
      localStorage.setItem("themis_theme", "dark");
    } else {
      root.classList.remove("dark");
      localStorage.setItem("themis_theme", "light");
    }
  }, [darkMode]);

  const toggleTheme = () => setDarkMode((prev) => !prev);

  return (
    <ThemeContext.Provider value={{ darkMode, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}
