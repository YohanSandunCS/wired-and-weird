import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import ChatAssistant from "@/components/ChatAssistant";

const inter = Inter({
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Medi Runner Team WW",
  description:
    "Robotics competition console interface for team coordination and robot management",
};

// Control ChatAssistant visibility via environment variable
const SHOW_CHAT_ASSISTANT =
  process.env.NEXT_PUBLIC_ENABLE_CHAT_ASSISTANT === "true";

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${inter.className} antialiased bg-[#0B0F2A] text-gray-100`}
      >
        {children}
        {SHOW_CHAT_ASSISTANT && <ChatAssistant />}
      </body>
    </html>
  );
}
