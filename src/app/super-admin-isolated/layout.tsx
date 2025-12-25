export default function SuperAdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head>
        <title>Super Admin - Isolated</title>
        <style>{`
          body { font-family: system-ui, sans-serif; margin: 0; padding: 0; }
        `}</style>
      </head>
      <body>
        {children}
      </body>
    </html>
  );
}