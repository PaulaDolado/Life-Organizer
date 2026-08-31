import { FormEvent, useState } from "react";
import { useAuth } from "../context/AuthContext";
import { api, ApiError } from "../api/client";
import { User } from "../types";

// Diálogo de perfil: se abre al hacer click en el nombre del usuario en la barra lateral (ver
// AppShell, que también refleja en el pie de la barra cualquier cambio guardado aquí — vía
// updateUser, que actualiza el contexto al instante). Dos formularios independientes (datos
// personales y contraseña) porque son dos llamadas a la API distintas con su propio estado de
// carga/error.
//
// `username` y `email` son dos campos independientes desde que se separó el login por username
// del email (antes el "nombre de usuario" era directamente el email). El username tiene el
// cooldown de 15 días (ver nextUsernameChangeAllowedAt); el email no tiene cooldown, pero
// cambiarlo resetea la verificación y hay que confirmarlo de nuevo (ver "Reenviar verificación").
function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("es-ES", { day: "numeric", month: "long", year: "numeric" });
}

export function ProfileDialog({ onClose }: { onClose: () => void }) {
  const { user, updateUser, resendVerification } = useAuth();

  const [username, setUsername] = useState(user?.username ?? "");
  const [name, setName] = useState(user?.name ?? "");
  const [lastName, setLastName] = useState(user?.lastName ?? "");
  const [email, setEmail] = useState(user?.email ?? "");
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileError, setProfileError] = useState<string | null>(null);
  const [profileSaved, setProfileSaved] = useState(false);
  // "Guardar cambios" pide confirmar antes de mandar el PUT: primer click deja el formulario en
  // este estado (el botón cambia de texto), un segundo click ya envía de verdad. Cualquier
  // edición posterior (markProfileDirty) cancela la confirmación pendiente — no tiene sentido
  // conservarla si el usuario ha seguido escribiendo otra cosa distinta a lo que confirmó.
  const [confirmingSave, setConfirmingSave] = useState(false);

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordSaving, setPasswordSaving] = useState(false);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [passwordSaved, setPasswordSaved] = useState(false);

  const [resendSaving, setResendSaving] = useState(false);
  const [resendSent, setResendSent] = useState(false);
  const [resendError, setResendError] = useState<string | null>(null);

  const trimmedUsername = username.trim();
  const trimmedName = name.trim();
  const trimmedLastName = lastName.trim();
  const trimmedEmail = email.trim();

  const isChangingUsername = trimmedUsername !== (user?.username ?? "");
  const isChangingEmail = trimmedEmail !== (user?.email ?? "");

  const profileUnchanged =
    !isChangingUsername && trimmedName === (user?.name ?? "") && trimmedLastName === (user?.lastName ?? "") && !isChangingEmail;

  // El username solo se puede cambiar 1 vez cada 15 días — el backend es la fuente de verdad
  // (devuelve 429 si se intenta antes de tiempo), esto es solo para no dejar que el usuario
  // escriba uno nuevo y descubra el límite recién al darle a guardar.
  const usernameLocked = !!user?.nextUsernameChangeAllowedAt && new Date(user.nextUsernameChangeAllowedAt) > new Date();

  const markProfileDirty = () => {
    setProfileSaved(false);
    setProfileError(null);
    setConfirmingSave(false);
  };

  const saveProfile = async (e: FormEvent) => {
    e.preventDefault();
    if (!trimmedUsername || !trimmedName || !trimmedEmail || profileUnchanged) return;
    if (!confirmingSave) {
      setConfirmingSave(true);
      return;
    }
    setConfirmingSave(false);
    setProfileSaving(true);
    setProfileError(null);
    try {
      const profile = await api.put<User>("/auth/me", {
        username: trimmedUsername,
        name: trimmedName,
        lastName: trimmedLastName || null,
        email: trimmedEmail,
      });
      updateUser({
        username: profile.username,
        name: profile.name,
        lastName: profile.lastName,
        email: profile.email,
        emailVerified: profile.emailVerified,
        nextUsernameChangeAllowedAt: profile.nextUsernameChangeAllowedAt,
      });
      setResendSent(false);
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

  const handleResendVerification = async () => {
    setResendSaving(true);
    setResendError(null);
    try {
      await resendVerification();
      setResendSent(true);
    } catch (err) {
      setResendError(err instanceof ApiError ? err.message : "No se pudo mandar el email de verificación.");
    } finally {
      setResendSaving(false);
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
          <label className="mb-1 flex flex-col gap-1 text-xs font-bold uppercase tracking-widest text-muted-foreground">
            Nombre de usuario
            <input
              value={username}
              onChange={(e) => {
                setUsername(e.target.value);
                markProfileDirty();
              }}
              required
              minLength={3}
              maxLength={30}
              disabled={usernameLocked}
              title="Minúsculas, números, puntos o guiones bajos"
              className={`field-input normal-case tracking-normal ${usernameLocked ? "cursor-not-allowed text-muted-foreground opacity-70" : ""}`}
            />
          </label>
          <p className="mb-3 text-xs text-muted-foreground">
            {usernameLocked
              ? `Ya lo cambiaste hace poco — podrás volver a cambiarlo el ${formatDate(user!.nextUsernameChangeAllowedAt as string)}.`
              : "Sirve para iniciar sesión (también puedes usar el email). Solo se puede cambiar 1 vez cada 15 días."}
          </p>

          <label className="mb-1 flex flex-col gap-1 text-xs font-bold uppercase tracking-widest text-muted-foreground">
            Email
            <input
              type="email"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                markProfileDirty();
              }}
              required
              className="field-input normal-case tracking-normal"
            />
          </label>
          <div className="mb-3 flex items-center gap-2 text-xs">
            {user?.emailVerified ? (
              <span className="text-primary">✓ Verificado</span>
            ) : (
              <>
                <span className="text-muted-foreground">⚠️ Sin verificar</span>
                <button
                  type="button"
                  onClick={handleResendVerification}
                  disabled={resendSaving}
                  className="cursor-pointer text-muted-foreground underline hover:text-foreground disabled:cursor-not-allowed"
                >
                  {resendSaving ? "Enviando…" : "Reenviar verificación"}
                </button>
                {resendSent && <span className="text-primary">Enviado.</span>}
              </>
            )}
          </div>
          {resendError && <p className="-mt-2 mb-3 text-xs text-destructive">⚠️ {resendError}</p>}

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
          {confirmingSave && !profileSaving && (
            <p className="mt-3 text-xs text-muted-foreground">
              {isChangingUsername && isChangingEmail
                ? "Vas a cambiar el nombre de usuario (no podrás volver a cambiarlo hasta pasados 15 días) y el email (tendrás que verificarlo de nuevo)."
                : isChangingUsername
                  ? "Vas a cambiar tu nombre de usuario — no podrás volver a cambiarlo hasta pasados 15 días."
                  : isChangingEmail
                    ? "Vas a cambiar tu email — tendrás que verificarlo de nuevo."
                    : "¿Guardar estos cambios?"}
            </p>
          )}

          <button
            type="submit"
            disabled={profileSaving || !trimmedUsername || !trimmedName || !trimmedEmail || profileUnchanged}
            className={`mt-4 ${confirmingSave ? "btn-dark" : "btn-primary"}`}
          >
            {profileSaving ? "Guardando..." : confirmingSave ? "¿Confirmar guardar?" : "Guardar cambios"}
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
