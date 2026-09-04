import Svg, { Path, Rect } from "react-native-svg";

// Icono de carpeta de archivador — evoca la misma idea que `NotebookCover` en
// dashboard/src/pages/ProyectosPage.tsx (pestaña recortada + tapa) pero como icono SVG en vez de
// una forma recortada con CSS, ya que ese recorte concreto no tiene un equivalente directo en RN.
// Dos tonos: `color` para el cuerpo de la carpeta (con su pestaña) y `shade` para la solapa
// frontal, más clara u oscura que el cuerpo — el mismo contraste de dos capas que la pestaña de
// NotebookCover, con la gama de "libreta" ya definida en theme.ts (`colors.cover` / `colors.secondary`),
// no colores nuevos inventados para parecerse a una carpeta amarilla genérica.
export function FolderIcon({ size = 40, color, shade }: { size?: number; color: string; shade: string }) {
  const height = (size * 80) / 100;
  return (
    <Svg width={size} height={height} viewBox="0 0 100 80">
      {/* pestaña, dibujada primero para que el cuerpo tape su mitad inferior */}
      <Rect x={6} y={10} width={36} height={14} rx={5} fill={color} />
      {/* cuerpo/tapa trasera de la carpeta */}
      <Rect x={4} y={18} width={92} height={54} rx={10} fill={color} />
      {/* solapa delantera, en el tono de contraste */}
      <Path d="M12,68 L17,36 Q18,32 23,32 L77,32 Q82,32 83,36 L88,68 Q88,72 84,72 L16,72 Q12,72 12,68 Z" fill={shade} />
    </Svg>
  );
}
