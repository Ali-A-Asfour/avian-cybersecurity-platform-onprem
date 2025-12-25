'use client';

export default function SuperAdminIsolatedPage() {
  return (
    <div style={{ padding: '2rem' }}>
      <h1 style={{ fontSize: '2rem', fontWeight: 'bold', marginBottom: '1rem' }}>
        Super Admin Dashboard (Isolated)
      </h1>
      <p>This is a completely isolated super admin page without any context providers.</p>
      <button 
        style={{ 
          padding: '0.5rem 1rem', 
          backgroundColor: '#3b82f6', 
          color: 'white', 
          border: 'none', 
          borderRadius: '0.25rem',
          cursor: 'pointer',
          marginTop: '1rem'
        }}
        onClick={() => alert('Button clicked!')}
      >
        Test Button
      </button>
    </div>
  );
}