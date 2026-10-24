// Turning the AiSList subscription on and off, shared by popup.js and
// welcome.js. `save(patch)` merges the patch into the stored settings.
// background.js (permissions.onAdded/onRemoved) finishes the job if the page
// closes while Chrome shows the permission prompt.
(function (root) {
  const RAW_ORIGIN = 'https://raw.githubusercontent.com/*';

  // Read-modify-write of the stored settings, for pages that keep no copy.
  async function patchSettings(patch) {
    const { settings = {} } = await chrome.storage.local.get('settings');
    await chrome.storage.local.set({ settings: { ...settings, ...patch } });
  }

  // Must be called straight from a click handler: Chrome only shows the
  // permission prompt for a user gesture, so the request comes first.
  // Resolves to true if the list is now on.
  async function turnOn(save = patchSettings) {
    let granted = false;
    try { granted = await chrome.permissions.request({ origins: [RAW_ORIGIN] }); } catch { /* denied */ }
    if (!granted) return false;
    await save({ aislist: true, onboarded: true });
    chrome.runtime.sendMessage({ action: 'aislist:refresh' }).catch(() => {});
    return true;
  }

  async function turnOff(save = patchSettings) {
    await save({ aislist: false });
    await chrome.storage.local.remove(['aislistData', 'aislistMeta']);
    chrome.permissions.remove({ origins: [RAW_ORIGIN] }).catch(() => {});
  }

  root.AILF_LIST = { RAW_ORIGIN, patchSettings, turnOn, turnOff };
})(globalThis);
