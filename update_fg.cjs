const fs = require('fs');

let c = fs.readFileSync('server/services/fortigateService.js', 'utf8');

if (!c.includes('allocateFortigateGroup')) {
  c += `\n\n/**
 * Allocates a FortiGate group for an IP based on current database capacity
 */
export const allocateFortigateGroup = (bannedIps, isPermanent, settings) => {
  const permGroup = settings.permGroup || 'Pulse_Perm';
  if (isPermanent) {
    return permGroup;
  }

  const tempGroups = settings.tempGroups || ['Pulse_Temp_1', 'Pulse_Temp_2', 'Pulse_Temp_3'];
  const maxPerGroup = settings.maxPerGroup || 600;

  const groupCounts = {};
  tempGroups.forEach(g => groupCounts[g] = 0);

  (bannedIps || []).forEach(b => {
    if (b.fortigateGroup && groupCounts[b.fortigateGroup] !== undefined) {
      groupCounts[b.fortigateGroup]++;
    }
  });

  for (const group of tempGroups) {
    if (groupCounts[group] < maxPerGroup) {
      return group;
    }
  }

  return tempGroups[tempGroups.length - 1];
};\n`;
}

c = c.replace('export const banIpAddress = async (settings, ip) => {', 'export const banIpAddress = async (settings, ip, fortigateGroup = null) => {');
c = c.replace('return await triggerFortigateWebhook(settings.banUrl, settings.apiToken, ip, settings.addressGroup);', 'return await triggerFortigateWebhook(settings.banUrl, settings.apiToken, ip, fortigateGroup || settings.addressGroup);');

c = c.replace('export const unbanIpAddress = async (settings, ip) => {', 'export const unbanIpAddress = async (settings, ip, fortigateGroup = null) => {');
c = c.replace('return await triggerFortigateWebhook(settings.unbanUrl, settings.apiToken, ip, settings.addressGroup);', 'return await triggerFortigateWebhook(settings.unbanUrl, settings.apiToken, ip, fortigateGroup || settings.addressGroup);');

fs.writeFileSync('server/services/fortigateService.js', c);
console.log('Fortigate service updated successfully');
