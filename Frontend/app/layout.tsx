export const metadata = {
  title: "AI Avatar",
  description: "Human-like AI Avatar Interaction System",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          padding: 0,
          width: "100%",
          height: "100%",
          overflow: "hidden",
          background: "#07070f",
        }}
      >
        {children}
      </body>
    </html>
  );
}