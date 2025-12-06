import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Improbix",
  description: "AI Agent Task Management",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="font-sans antialiased">{children}</body>
    </html>
  );
}
