(function(root){
  const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  function addMonths(date, months) {
    const [year, month, day] = date.split('-').map(Number);
    const sourceLast = new Date(Date.UTC(year, month, 0)).getUTCDate();
    const target = new Date(Date.UTC(year, month - 1 + months, 1));
    const last = new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0)).getUTCDate();
    target.setUTCDate(day === sourceLast ? last : Math.min(day, last));
    return target.toISOString().slice(0, 10);
  }
  async function token() {
    const client = root.supabaseClient;
    if (!client) throw new Error('Connexion HomePilot indisponible.');
    const {data, error} = await client.auth.getSession();
    if (error) throw error;
    if (!data?.session?.access_token) throw new Error('Session expirée. Reconnecte-toi.');
    return data.session.access_token;
  }
  // Keep an uncertain write's identifier across retries and page refreshes.
  const memory = new Map();
  function operation(key, payload) {
    const fingerprint = JSON.stringify(payload);
    let current = memory.get(key);
    try { current = JSON.parse(sessionStorage.getItem('hp-write-'+key)) || current; } catch {}
    if (!current || current.fingerprint !== fingerprint) current = {fingerprint, id: crypto.randomUUID()};
    memory.set(key, current);
    try { sessionStorage.setItem('hp-write-'+key, JSON.stringify(current)); } catch {}
    return current.id;
  }
  function complete(key) {
    memory.delete(key);
    try { sessionStorage.removeItem('hp-write-'+key); } catch {}
  }
  function budgetFetch(input,init){
    const url=new URL(typeof input==='string'||input instanceof URL?input:input.url);
    if(url.origin==='https://vkfvjwxajgeafzyphjvh.supabase.co'&&/^\/rest\/v1\/(budget_[a-z_]+|mortgage_renewals)$/.test(url.pathname)){
      const params=new URLSearchParams(url.search);params.set('table',url.pathname.split('/').pop());
      const path='/api/budget-data?'+params.toString();
      return typeof Request!=='undefined'&&input instanceof Request
        ? fetch(new Request(new URL(path,root.location.origin),input),init)
        : fetch(path,init);
    }
    return fetch(input,init);
  }
  root.hpStability = {esc, addMonths, token, operation, complete, budgetFetch};
})(globalThis);
