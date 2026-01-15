import { useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';

export function OrganizationSettings() {
  const { profile } = useAuth();
  const [color, setColor] = useState(profile?.org_id ? 'Gold' : 'Gold');
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSave = async () => {
    if (!profile?.org_id) return alert('No organization');
    setLoading(true);
    try {
      let logoUrl: string | null = null;
      if (logoFile) {
        const key = `logos/${profile.org_id}/${Date.now()}-${logoFile.name}`;
        const { error: uploadError } = await supabase.storage.from('org-uploads').upload(key, logoFile);
        if (uploadError) throw uploadError;
        const { data } = supabase.storage.from('org-uploads').getPublicUrl(key);
        logoUrl = data.publicUrl;
      }

      const update: any = { primary_color: color };
      if (logoUrl) update.logo_url = logoUrl;

      const { error } = await supabase.from('organizations').update(update).eq('org_id', profile.org_id);
      if (error) throw error;
      alert('Organization settings saved');
    } catch (err: any) {
      console.error(err);
      alert(err.message || String(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-4 bg-white rounded">
      <h3 className="text-lg font-semibold mb-3">Organization Branding</h3>
      <label className="block mb-2">Primary Color</label>
      <select className="input mb-3" value={color} onChange={(e) => setColor(e.target.value)}>
        <option>Gold</option>
        <option>Silver</option>
        <option>Black</option>
      </select>

      <label className="block mb-2">Logo</label>
      <input type="file" onChange={(e) => setLogoFile(e.target.files?.[0] ?? null)} />

      <div className="mt-4">
        <button className="btn-primary" onClick={handleSave} disabled={loading}>{loading ? 'Saving...' : 'Save'}</button>
      </div>
    </div>
  );
}
