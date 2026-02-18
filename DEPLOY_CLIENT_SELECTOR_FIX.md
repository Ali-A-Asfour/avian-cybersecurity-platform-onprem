# Deploy Client Selector Fix

## Changes Made
1. Added multi-tenant demo alerts (12 alerts across 3 tenants)
2. Added tenant filtering to demo alerts API
3. Added sessionStorage persistence for selected tenant
4. Enhanced API client with sessionStorage fallback

## Files Changed
- `src/app/api/alerts-incidents/demo/alerts/route.ts`
- `src/contexts/DemoContext.tsx`
- `src/lib/api-client.ts`

## Deployment Steps

### Option 1: Quick Deployment (Recommended)
```bash
# 1. Commit changes locally
git add .
git commit -m "fix: add multi-tenant support for security analyst client selector

- Add demo alerts for 3 tenants (ACME, TechStart, Global Finance)
- Filter demo alerts by selected tenant from x-selected-tenant-id header
- Add sessionStorage persistence for selected tenant
- Enhance API client with sessionStorage fallback for tenant ID
- Update metadata counts to respect selected tenant"

# 2. Push to GitHub
git push origin main

# 3. SSH to server
ssh avian@209.227.150.115

# 4. Pull changes and rebuild
cd /home/avian/avian-cybersecurity-platform-onprem
git pull origin main
sudo docker-compose -f docker-compose.prod.yml down
sudo docker-compose -f docker-compose.prod.yml build app
sudo docker-compose -f docker-compose.prod.yml up -d

# 5. Check logs
sudo docker-compose -f docker-compose.prod.yml logs -f app
```

### Option 2: Manual File Transfer
If git push/pull doesn't work:

```bash
# From your Mac, copy files to server
scp src/app/api/alerts-incidents/demo/alerts/route.ts avian@209.227.150.115:/home/avian/avian-cybersecurity-platform-onprem/src/app/api/alerts-incidents/demo/alerts/
scp src/contexts/DemoContext.tsx avian@209.227.150.115:/home/avian/avian-cybersecurity-platform-onprem/src/contexts/
scp src/lib/api-client.ts avian@209.227.150.115:/home/avian/avian-cybersecurity-platform-onprem/src/lib/

# Then SSH and rebuild
ssh avian@209.227.150.115
cd /home/avian/avian-cybersecurity-platform-onprem
sudo docker-compose -f docker-compose.prod.yml down
sudo docker-compose -f docker-compose.prod.yml build app
sudo docker-compose -f docker-compose.prod.yml up -d
```

## Testing After Deployment

### 1. Access Platform
```bash
# From your Mac
ssh -L 8443:localhost:443 avian@209.227.150.115

# Open browser
https://localhost:8443
```

### 2. Login
```
Email: analyst@avian.local
Password: analyst123
```

### 3. Test Tenant Selector
1. Go to Alerts & Incidents
2. Open browser console (F12)
3. Click 🏢 icon in header
4. Select different tenants
5. Verify alerts change

### 4. Expected Results
- ACME Corp: 6 alerts
- TechStart Inc: 3 alerts
- Global Finance Ltd: 3 alerts

### 5. Check Console Logs
Look for:
```
DemoContext: Set global tenant ID: <tenant-id>
🌐 API Client: Found selected tenant ID: <tenant-id>
🔍 Demo Alerts API: selectedTenant=<tenant-id>
🔍 Filtered to tenant <tenant-id>: X alerts
```

## Troubleshooting

### Issue: Still showing same alerts
**Solution**: Clear browser cache and sessionStorage
```javascript
// In browser console
sessionStorage.clear();
location.reload();
```

### Issue: Tenant selector not showing
**Solution**: Verify user role is security_analyst
```javascript
// In browser console
console.log(localStorage.getItem('auth-user'));
```

### Issue: Build fails
**Solution**: Check Docker logs
```bash
sudo docker-compose -f docker-compose.prod.yml logs app
```

### Issue: Changes not reflected
**Solution**: Hard rebuild
```bash
sudo docker-compose -f docker-compose.prod.yml down -v
sudo docker-compose -f docker-compose.prod.yml build --no-cache app
sudo docker-compose -f docker-compose.prod.yml up -d
```

## Rollback

If deployment causes issues:
```bash
# On server
cd /home/avian/avian-cybersecurity-platform-onprem
git log --oneline -5
git revert <commit-hash>
sudo docker-compose -f docker-compose.prod.yml down
sudo docker-compose -f docker-compose.prod.yml build app
sudo docker-compose -f docker-compose.prod.yml up -d
```

## Verification Checklist
- [ ] Changes committed to git
- [ ] Changes pushed to GitHub
- [ ] Server pulled latest changes
- [ ] Docker containers rebuilt
- [ ] Application started successfully
- [ ] Can login as security analyst
- [ ] Tenant selector shows multiple tenants
- [ ] Alerts change when switching tenants
- [ ] ACME Corp shows 6 alerts
- [ ] TechStart Inc shows 3 alerts
- [ ] Global Finance Ltd shows 3 alerts
- [ ] Console logs show tenant filtering
- [ ] My Alerts respects selected tenant
- [ ] Selection persists after page refresh
