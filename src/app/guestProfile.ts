export type GuestProfile = { id: string; name: string };

function createGuestId(): string {
  if (typeof crypto.randomUUID === "function") return crypto.randomUUID();
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, character => {
    const value = Math.floor(Math.random() * 16);
    return (character === "x" ? value : (value & 0x3) | 0x8).toString(16);
  });
}

function loadGuestProfile(): GuestProfile {
  try {
    const stored = JSON.parse(localStorage.getItem("cloneroyale.profile") ?? "null") as Partial<GuestProfile> | null;
    if (stored && typeof stored.id === "string" && /^[a-f0-9-]{36}$/i.test(stored.id)
      && typeof stored.name === "string" && stored.name.trim()) {
      return { id: stored.id, name: stored.name.trim().slice(0, 16) };
    }
  } catch { /* Replace invalid local profile data. */ }
  const profile = { id: createGuestId(), name: "Guest" };
  localStorage.setItem("cloneroyale.profile", JSON.stringify(profile));
  return profile;
}

export function initializeGuestProfile(onProfileChanged: (profile: GuestProfile) => void): {
  getProfile: () => GuestProfile;
} {
  let profile = loadGuestProfile();
  const profileButton = document.getElementById("profile-button");
  const profileNameLabel = document.getElementById("profile-name");
  const profileAvatar = document.getElementById("profile-avatar");
  const profilePanel = document.getElementById("profile-panel");
  const profileNameInput = document.getElementById("profile-name-input");
  const profileError = document.getElementById("profile-error");
  const saveProfileButton = document.getElementById("save-profile");
  const closeProfileButton = document.getElementById("close-profile");
  const menuProfileButton = document.getElementById("menu-profile");
  const menuProfileName = document.getElementById("menu-profile-name");

  function render(): void {
    if (profileNameLabel) profileNameLabel.textContent = profile.name;
    if (menuProfileName) menuProfileName.textContent = profile.name;
    if (profileAvatar) profileAvatar.textContent = profile.name.charAt(0).toUpperCase();
    if (profileButton) profileButton.setAttribute("aria-label", "Player profile: " + profile.name);
    if (profileNameInput instanceof HTMLInputElement) profileNameInput.value = profile.name;
  }

  function open(): void {
    render();
    if (profilePanel instanceof HTMLDivElement) profilePanel.hidden = false;
    if (profileNameInput instanceof HTMLInputElement) {
      profileNameInput.focus();
      profileNameInput.select();
    }
  }

  function close(): void {
    if (profilePanel instanceof HTMLDivElement) profilePanel.hidden = true;
    if (profileError) profileError.textContent = "";
  }

  menuProfileButton?.addEventListener("click", open);
  closeProfileButton?.addEventListener("click", close);
  profilePanel?.addEventListener("click", event => {
    if (event.target === profilePanel) close();
  });
  saveProfileButton?.addEventListener("click", () => {
    const name = profileNameInput instanceof HTMLInputElement ? profileNameInput.value.trim() : "";
    if (!name) {
      if (profileError) profileError.textContent = "Enter a display name.";
      return;
    }
    profile = {
      ...profile,
      name: name.replace(/[\u0000-\u001f\u007f]/g, "").slice(0, 16)
    };
    localStorage.setItem("cloneroyale.profile", JSON.stringify(profile));
    render();
    onProfileChanged(profile);
    close();
  });
  profileNameInput?.addEventListener("keydown", event => {
    if (event.key === "Enter") saveProfileButton?.click();
    if (event.key === "Escape") close();
  });

  render();
  return { getProfile: () => profile };
}
