import React from "react";
import ReactDOM from "react-dom/client";
import { PrivyProvider } from "@privy-io/react-auth";
import App from "./App";
import { ThemeProvider } from "./context/ThemeContext";
import { ThemisProvider } from "./context/ThemisContext";
import "./index.css";

const PRIVY_APP_ID = "cmucf5bf7034l0cl2v3l0do5j";

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <PrivyProvider
      appId={PRIVY_APP_ID}
      config={{
        loginMethods: ["email"],
        appearance: {
          theme: "dark",
          accentColor: "#d4f717",
          logo: "/themis-logo.svg",
          showWalletLoginFirst: false,
        },
      }}
    >
      <ThemeProvider>
        <ThemisProvider>
          <App />
        </ThemisProvider>
      </ThemeProvider>
    </PrivyProvider>
  </React.StrictMode>
);
