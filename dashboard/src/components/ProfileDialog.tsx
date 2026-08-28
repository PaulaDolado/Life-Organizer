import { FormEvent, useState } from "react";
import { useAuth } from "../context/AuthContext";
import { api, ApiError } from "../api/client";
import { User } from "../types";

// Diálogo de perfil: se abre al hacer click en el nombre del usuario en la barra lateral (ver
// AppShell). Dos formularios independientes (datos personales y contraseña) porque son dos
// llamadas a la API distintas con su propio estado de carga/error. Datos personales usa el
// PUT /auth/me que ya existía (ahora con lastName y email además de name); el cambio de
// contraseña es aparte (PUT /auth/me/password, requiere la contraseña actual).
//
// No hay un "nombre de usuario" aparte: el nombre de usuario ES el email con el que se inicia
// sesión, así que se edita como un campo normal más — el backend comprueba que esté libre
// (409 si ya lo usa otra cuenta) antes de guardarlo.
export function ProfileDialog({ onClose }: { onClose: () => void }) {
  const { user, updateUser } = useAuth();

  const [name, setName] = useState(user?.name ?? "");
  const [lastName, setLastName] = useState(user?.lastName ?? "");
  const [email, setEmail] = useState(user?.email ?? "");
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileError, setProfileError] = useState<string | null>(null);
  const [profileSaved, setProfileSaved] = useState(false);

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordSaving, setPasswordSaving] = useState(false);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [passwordSaved, setPasswordSaved] = useState(false);

  const trimmedName = name.trim();
  const trimmedLastName = lastName.trim();
  const trimmedEmail = email.trim();

  const profileUnchanged =
    trimmedName === (user?.name ?? "") && trimmedLastName === (user?.lastName ?? "") && trimmedEmail === (user?.email ?? "");

  const markProfileDirty = () => {
    setProfileSaved(false);
    setProfileError(null);
  };

  const saveProfile = async (e: FormEvent) => {
    e.preventDefault();
    if (!trimmedName || !trimmedEmail || profileUnchanged) return;
    setProfileSaving(true);
    setProfileError(null);
    try {
      const profile = await api.put<Pick<User, "name" | "lastName" | "email">>("/auth/me", {
        name: trimmedName,
        lastName: trimmedLastName || null,
        email: trimmedEmail,
      });
      updateUser({ name: profile.name, lastName: profile.lastName, email: profile.email });
      setProfileSaved(true);
    } catch (err) {
      setProfileError(err instanceof ApiError ? err.message : "No se pudieron guardar los cambios.");
    } finally {
      setProfileSaving(false);
    }
  };

  const savePassword = async (e: FormEvent) => {
    e.preventDefault();
    setPasswordError(null);
    setPasswordSaved(false);
    if (newPassword.length < 8) {
      setPasswordError("La nueva contraseña debe tener al menos 8 caracteres.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordError("Las dos contraseñas nuevas no coinciden.");
      return;
    }
    setPasswordSaving(true);
    try {
      await api.put("/auth/me/password", { currentPassword, newPassword });
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setPasswordSaved(true);
    } catch (err) {
      setPasswordError(err instanceof ApiError ? err.message : "No se pudo cambiar la contraseña.");
    } finally {
      setPasswordSaving(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-foreground/50 p-4"
      onClick={onClose}
    >
      <div onClick={(e) => e.stopPropagation()} className="w-full max-w-md rounded-3xl bg-card p-6 shadow-[var(--shadow-soft)] sm:p-8">
        <div className="mb-6 flex items-center justify-between">
          <h2 className="font-serif text-xl">Tu perfil</h2>
          <button type="button" onClick={onClose} className="cursor-pointer text-xs text-muted-foreground hover:text-foreground">
            ✕ Cerrar
          </button>
        </div>

        <form onSubmit={saveProfile} className="mb-8">
          <label className="mb-3 flex flex-col gap-1 text-xs font-bold uppercase tracking-widest text-muted-foreground">
            Nombre de usuario
            <input
              type="email"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                markProfileDirty();
              }}
              required
              title="El nombre de usuario es el email con el que inicias sesión"
              className="field-input normal-case tracking-normal"
            />
          </label>
          <p className="-mt-2 mb-3 text-xs text-muted-foreground">Es el email con el que inicias sesión — si lo cambias, úsalo la próxima vez.</p>

          <div className="grid grid-cols-2 gap-3">
            <label className="flex flex-col gap-1 text-xs font-bold uppercase tracking-widest text-muted-foreground">
              Nombre
              <input
                value={name}
                onChange={(e) => {
                  setName(e.target.value);
                  markProfileDirty();
                }}
                minLength={2}
                required
                className="field-input normal-case tracking-normal"
              />
            </label>
            <label className="flex flex-col gap-1 text-xs font-bold uppercase tracking-widest text-muted-foreground">
              Apellido
              <input
                value={lastName}
                onChange={(e) => {
                  setLastName(e.target.value);
                  markProfileDirty();
                }}
                placeholder="Opcional"
                className="field-input normal-case tracking-normal"
              />
            </label>
          </div>

          {profileError && (
            <p className="mt-3 rounded-xl border border-destructive/30 bg-destructive/5 p-3 text-xs text-destructive">
              ⚠️ {profileError}
            </p>
          )}
          {profileSaved && <p className="mt-3 text-xs text-primary">Datos actualizados.</p>}

          <button type="submit" disabled={profileSaving || !trimmedName || !trimmedEmail || profileUnchanged} className="btn-primary mt-4">
            {profileSaving ? "Guardando..." : "Guardar cambios"}
          </button>
        </form>

        <div className="border-t border-border pt-6">
          <h3 className="mb-4 text-xs font-bold uppercase tracking-widest text-muted-foreground">Cambiar contraseña</h3>
          <form onSubmit={savePassword} className="grid gap-3">
            <input
              type="password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              placeholder="Contraseña actual"
              required
              className="field-input"
            />
            <input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="Nueva contraseña"
              required
              minLength={8}
              className="field-input"
            />
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Repite la nueva contraseña"
              required
              minLength={8}
              className="field-input"
            />

            {passwordError && (
              <p className="rounded-xl border border-destructive/30 bg-destructive/5 p-3 text-xs text-destructive">⚠️ {passwordError}</p>
            )}
            {passwordSaved && <p className="text-xs text-primary">Contraseña actualizada.</p>}

            <button type="submit" disabled={passwordSaving} className="btn-primary">
              {passwordSaving ? "Guardando..." : "Cambiar contraseña"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
