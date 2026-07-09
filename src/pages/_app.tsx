import type { AppProps } from "next/app";
import "@/styles/globals.css";
import { Toaster } from "react-hot-toast";

export default function App({ Component, pageProps }: AppProps) {
  return (
    <>
      <a href="#main-content" className="skip-link">
        Saltar al contenido
      </a>
      <main id="main-content" className="min-h-screen">
        <Component {...pageProps} />
      </main>
      <Toaster
        position="top-right"
        gutter={12}
        toastOptions={{
          duration: 3500,
          style: {
            borderRadius: "16px",
            border: "1px solid rgba(148, 163, 184, 0.24)",
            background: "#0f172a",
            color: "#f8fafc",
            boxShadow: "0 20px 45px rgba(15, 23, 42, 0.18)",
          },
          success: {
            iconTheme: {
              primary: "#22c55e",
              secondary: "#f8fafc",
            },
          },
          error: {
            iconTheme: {
              primary: "#ef4444",
              secondary: "#f8fafc",
            },
          },
        }}
      />
    </>
  );
}
