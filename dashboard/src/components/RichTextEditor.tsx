import { ReactNode, useEffect, useRef } from "react";

// Editor de texto enriquecido simple (negrita, cursiva, listas, imágenes) basado en
// contentEditable + document.execCommand. execCommand está deprecado en el estándar, pero
// sigue funcionando en los navegadores basados en Chromium/Firefox — para un editor interno
// como este, con estas pocas operaciones, evita meter una librería completa (TipTap, Slate...)
// solo para poner negrita y viñetas.
const MAX_IMAGE_BYTES = 3 * 1024 * 1024; // 3MB por imagen — el body de /projects admite hasta 10MB en total

interface RichTextEditorProps {
  value: string;
  onChange: (html: string) => void;
  placeholder?: string;
}

export function RichTextEditor({ value, onChange, placeholder }: RichTextEditorProps) {
  const editorRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Sincroniza el HTML externo (p.ej. al cambiar de página) sin pelear con el cursor mientras
  // el usuario escribe: solo se reescribe si el contenido realmente cambió por fuera.
  useEffect(() => {
    if (editorRef.current && editorRef.current.innerHTML !== value) {
      editorRef.current.innerHTML = value;
    }
  }, [value]);

  const emitChange = () => onChange(editorRef.current?.innerHTML ?? "");

  const exec = (command: string, arg?: string) => {
    editorRef.current?.focus();
    document.execCommand(command, false, arg);
    emitChange();
  };

  const insertImage = (file: File) => {
    if (!file.type.startsWith("image/")) return;
    if (file.size > MAX_IMAGE_BYTES) {
      window.alert("La imagen es demasiado grande (máx. 3 MB).");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => exec("insertImage", reader.result as string);
    reader.readAsDataURL(file);
  };

  return (
    <div className="overflow-hidden rounded-2xl border border-input bg-card">
      <div className="flex flex-wrap items-center gap-1 border-b border-border bg-muted/50 px-2 py-1.5">
        <ToolbarButton title="Negrita" className="font-bold" onClick={() => exec("bold")}>
          B
        </ToolbarButton>
        <ToolbarButton title="Cursiva" className="italic" onClick={() => exec("italic")}>
          I
        </ToolbarButton>
        <ToolbarButton title="Subrayado" className="underline" onClick={() => exec("underline")}>
          S
        </ToolbarButton>
        <div className="mx-1 h-5 w-px bg-border" />
        <ToolbarButton title="Lista con viñetas" onClick={() => exec("insertUnorderedList")}>
          • Lista
        </ToolbarButton>
        <ToolbarButton title="Lista numerada" onClick={() => exec("insertOrderedList")}>
          1. Lista
        </ToolbarButton>
        <div className="mx-1 h-5 w-px bg-border" />
        <ToolbarButton title="Insertar imagen" onClick={() => fileInputRef.current?.click()}>
          🖼 Imagen
        </ToolbarButton>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) insertImage(file);
            e.target.value = "";
          }}
        />
      </div>

      <div
        ref={editorRef}
        contentEditable
        onInput={emitChange}
        onBlur={emitChange}
        onPaste={(e) => {
          const item = Array.from(e.clipboardData.items).find((i) => i.type.startsWith("image/"));
          if (!item) return;
          e.preventDefault();
          const file = item.getAsFile();
          if (file) insertImage(file);
        }}
        data-placeholder={placeholder}
        className="rich-editor"
      />
    </div>
  );
}

function ToolbarButton({
  title,
  className = "",
  onClick,
  children,
}: {
  title: string;
  className?: string;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      title={title}
      onClick={onClick}
      className={`cursor-pointer whitespace-nowrap rounded-md px-2.5 py-1.5 text-xs text-muted-foreground transition-colors hover:bg-foreground/10 hover:text-foreground ${className}`}
    >
      {children}
    </button>
  );
}
