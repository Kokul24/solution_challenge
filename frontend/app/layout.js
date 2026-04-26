import { Space_Grotesk, Rajdhani } from "next/font/google";
import "./globals.css";

const spaceGrotesk = Space_Grotesk({
  subsets: ["latin"],
  variable: "--font-ui",
});

const rajdhani = Rajdhani({
  subsets: ["latin"],
  variable: "--font-heading",
  weight: ["500", "600", "700"],
});

export const metadata = {
  title: "AI Emergency Command System",
  description: "AI-powered tactical intelligence platform for emergency response",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body className={`${spaceGrotesk.variable} ${rajdhani.variable}`}>{children}</body>
    </html>
  );
}