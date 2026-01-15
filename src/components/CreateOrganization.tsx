import { useState } from 'react';
import { supabase } from '../lib/supabase';

export function CreateOrganization({ onClose }: { onClose?: () => void }) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [color, setColor] = useState('Gold');
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      // Create an org_id (client-side generated). You may prefer server-side generation.
      const orgId = `${name.toLowerCase().replace(/\s+/g, '-')}-${Date.now()}`;

      // Insert organization row (may require service role or relaxed RLS)
      const { error: orgErr } = await supabase.from('organizations').insert({
        org_id: orgId,
        name,
        primary_color: color,
      });
      if (orgErr) throw orgErr;

      // Sign up the first admin for this org
      const { data, error: signErr } = await supabase.auth.signUp({
        email,
        password,
      });
      if (signErr) throw signErr;

      if (data.user) {
        // Create profile tied to org
        const { error: profileErr } = await supabase.from('profiles').insert({
          id: data.user.id,
          email,
          full_name: name,
          role: 'admin',
          org_id: orgId,
        });
        if (profileErr) throw profileErr;
      }

      // Notify and close
      alert('Organization created. Please confirm email and sign in.');
      onClose?.();
    } catch (err: any) {
      console.error(err);
      setError(err.message || String(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 flex items-center justify-center bg-black/60">
      <form onSubmit={handleSubmit} className="bg-white p-6 rounded-lg w-96">
        <h2 className="text-xl font-semibold mb-4">Create Organization</h2>
        {error && <div className="text-red-600 mb-2">{error}</div>}
        <label className="block mb-2">Organization Name</label>
        <input className="input" value={name} onChange={(e) => setName(e.target.value)} required />

        <label className="block mt-3 mb-2">Admin Email</label>
        <input className="input" value={email} onChange={(e) => setEmail(e.target.value)} required />

        <label className="block mt-3 mb-2">Password</label>
        <input className="input" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />

        <label className="block mt-3 mb-2">Primary Color</label>
        <select className="input" value={color} onChange={(e) => setColor(e.target.value)}>
          <option>Gold</option>
          <option>Silver</option>
          <option>Black</option>
        </select>

        <div className="flex justify-end gap-2 mt-4">
          <button type="button" className="btn" onClick={() => onClose?.()}>Cancel</button>
          <button type="submit" className="btn-primary" disabled={loading}>{loading ? 'Creating...' : 'Create'}</button>
        </div>
      </form>
    </div>
  );
}
