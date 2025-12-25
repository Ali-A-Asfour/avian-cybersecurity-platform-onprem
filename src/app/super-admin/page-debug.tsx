export default function SuperAdminPage() {
  return (
    <div>
      <h1>Super Admin Dashboard</h1>
      <p>Ultra minimal page with no imports or client-side code.</p>
      <script dangerouslySetInnerHTML={{
        __html: `
          console.log('Super Admin page loaded successfully');
          window.addEventListener('error', function(e) {
            console.error('Global error caught:', e.error);
            alert('Error: ' + e.error.message + '\\nFile: ' + e.filename + '\\nLine: ' + e.lineno);
          });
          window.addEventListener('unhandledrejection', function(e) {
            console.error('Unhandled promise rejection:', e.reason);
            alert('Promise rejection: ' + e.reason);
          });
        `
      }} />
    </div>
  );
}