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
    if (!client) throw new Error('Connexion Nuvabri indisponible.');
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
  function guardForm(formId, buttonId, action) {
    let pending = false;
    return async (...args) => {
      if (pending) return;
      const form = root.document.getElementById(formId);
      for (const field of form?.querySelectorAll('input,select,textarea') || []) {
        if (!field.checkValidity()) { field.reportValidity(); field.focus(); return; }
      }
      const button = root.document.getElementById(buttonId);
      const status = root.document.getElementById(formId+'Error');
      if (status) status.textContent = '';
      pending = true; if (button) button.disabled = true;
      try { return await action(...args); }
      catch(error) { if (status) status.textContent = financialError(error); else root.alert(financialError(error)); }
      finally { pending = false; if (button) button.disabled = false; }
    };
  }
  async function insertOnce(client, table, payload) {
    const key = 'tool:'+table+':'+payload.user_id;
    const {updated_at, ...identityPayload} = payload;
    const id = operation(key,identityPayload);
    const result = await client.from(table).upsert({...payload,id},{onConflict:'id',ignoreDuplicates:true});
    if (!result.error) complete(key);
    return result;
  }
  function resetForm(id) {
    const form = root.document?.getElementById(id);
    for (const field of form?.querySelectorAll('input,select,textarea') || []) {
      if (field.type === 'checkbox') field.checked = field.defaultChecked || false;
      else if (field.options) field.value = Array.from(field.options).find(x => x.defaultSelected)?.value || field.options[0]?.value || '';
      else field.value = field.defaultValue || '';
    }
    form?.classList.add('hidden');
  }
  // Each tool owns its visible snapshot. Late requests cannot cross accounts.
  function financialError(error) {
    return error?.code === 'FINANCIAL_CONFLICT' ? error.message : 'Confirmation non reçue. Tes champs sont conservés : actualise les données et vérifie avant de recommencer.';
  }
  function financialStore(table, getClient, clear) {
    let owner, epoch = 0, readVersion = 0, observedClient;
    const rows = new Map(), pending = new Set();
    function account(id) {
      if (owner === id) return;
      const first = owner === undefined;
      owner = id;
      if (!first) { epoch++; readVersion++; rows.clear(); clear?.(); }
    }
    async function context() {
      const c = getClient(); if (!c) return null;
      if (observedClient !== c) {
        observedClient = c;
        c.auth.onAuthStateChange?.((_event, session) => account(session?.user?.id || null));
      }
      const started = epoch;
      const {data, error} = await c.auth.getUser();
      if (started !== epoch) return null;
      if (error) throw error;
      account(data?.user?.id || null);
      if (!owner) return null;
      const captured = epoch, userId = owner;
      return {c, userId, valid: () => epoch === captured && owner === userId};
    }
    async function read(build = q => q) {
      const version = ++readVersion, ctx = await context();
      if (!ctx || version !== readVersion) return null;
      try {
        const {data, error} = await build(ctx.c.from(table).select('*').eq('user_id',ctx.userId));
        if (!ctx.valid() || version !== readVersion) return null;
        if (error) throw error;
        const result = Array.isArray(data) ? data : data ? [data] : [];
        rows.clear(); for (const row of result) rows.set(row.id, {...row});
        return result;
      } catch(error) {
        if (!ctx.valid() || version !== readVersion) return null;
        rows.clear(); throw error;
      }
    }
    async function change(snapshot, patch, remove = false) {
      const conflict = message => Object.assign(new Error(message),{code:'FINANCIAL_CONFLICT'});
      if (!snapshot?.id || !snapshot.updated_at) throw conflict('Actualise les données avant de modifier cette fiche.');
      if (pending.has(snapshot.id)) return null;
      pending.add(snapshot.id);
      try {
        const ctx = await context();
        if (!ctx || snapshot.user_id !== ctx.userId) throw conflict('La connexion a changé. Rouvre cette fiche.');
        // Explicit version changes even when two requests occur in one millisecond.
        const updated_at = new Date(Math.max(Date.now(),Date.parse(snapshot.updated_at)+1)).toISOString();
        const base = ctx.c.from(table);
        const query = remove ? base.delete() : base.update({...patch,updated_at});
        const {data, error} = await query.eq('id',snapshot.id).eq('user_id',ctx.userId).eq('updated_at',snapshot.updated_at).select('*');
        if (!ctx.valid()) return null;
        if (error) throw error;
        const changed = data?.[0];
        if (!changed) {
          if (remove) {
            const check = await ctx.c.from(table).select('id').eq('id',snapshot.id).eq('user_id',ctx.userId).maybeSingle();
            if (!ctx.valid()) return null;
            if (check.error) throw check.error;
            if (!check.data) { rows.delete(snapshot.id); return snapshot; }
          }
          throw conflict('Cette fiche a changé ou la précédente tentative a déjà été enregistrée. Actualise et vérifie le montant avant de recommencer.');
        }
        if (remove) rows.delete(snapshot.id); else rows.set(snapshot.id,{...changed});
        return changed;
      } finally { pending.delete(snapshot.id); }
    }
    return {context, read, snapshot: id => rows.get(id) ? {...rows.get(id)} : null, change, remove: row => change(row,null,true)};
  }
  function nextFinancialDate(date, frequency) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date || '')) return null;
    const d = new Date(date+'T12:00:00Z');
    if (!Number.isFinite(d.getTime()) || d.toISOString().slice(0,10) !== date) return null;
    if (frequency === 'weekly' || frequency === 'biweekly') {
      d.setUTCDate(d.getUTCDate() + (frequency === 'weekly' ? 7 : 14));
      return d.toISOString().slice(0,10);
    }
    const months = {monthly:1,quarterly:3,yearly:12}[frequency];
    // Two monthly dates cannot be deduced from a single due date.
    return months ? addMonths(date,months) : null;
  }
  const pendingBudgetReads = new Map();
  function budgetFetch(input,init){
    const url=new URL(typeof input==='string'||input instanceof URL?input:input.url);
    if(url.origin==='https://vkfvjwxajgeafzyphjvh.supabase.co'&&/^\/rest\/v1\/(budget_[a-z_]+|mortgage_renewals)$/.test(url.pathname)){
      const params=new URLSearchParams(url.search);params.set('table',url.pathname.split('/').pop());
      const path='/api/budget-data?'+params.toString();
      const request=typeof Request!=='undefined'&&input instanceof Request;
      const target=request?new Request(new URL(path,root.location.origin),input):path;
      const method=String(init?.method||(request?input.method:'GET')).toUpperCase();
      if(method!=='GET'){
        // A post-write refresh must never reuse a pre-write response, even for another table.
        pendingBudgetReads.clear();
        return Promise.resolve(fetch(target,init)).finally(()=>pendingBudgetReads.clear());
      }
      // An explicitly abortable request owns its cancellation; do not share it.
      if(request||init?.signal||typeof Headers==='undefined')return fetch(target,init);
      const headers=Array.from(new Headers(init?.headers).entries()).sort(([a],[b])=>a.localeCompare(b));
      const key=JSON.stringify([path,headers,init?.credentials,init?.cache,init?.mode]);
      let pending=pendingBudgetReads.get(key);
      if(!pending){
        pending=Promise.resolve(fetch(target,init));pendingBudgetReads.set(key,pending);
        const clear=()=>{if(pendingBudgetReads.get(key)===pending)pendingBudgetReads.delete(key)};
        pending.then(clear,clear);
      }
      return pending.then(response=>response.clone());
    }
    return fetch(input,init);
  }
  root.hpStability = {esc, addMonths, token, operation, complete, budgetFetch, guardForm, insertOnce, resetForm, financialStore, financialError, nextFinancialDate};
})(globalThis);
