import jsPDF from "jspdf";
import html2canvas from "html2canvas";
import { format } from "date-fns";
import logoSrc from "@/assets/logo.png";

let cachedLogoBase64: string | null = null;

export const loadLogoBase64 = (): Promise<string> => {
  if (cachedLogoBase64) return Promise.resolve(cachedLogoBase64);
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
      const ctx = canvas.getContext("2d")!;
      ctx.drawImage(img, 0, 0);
      cachedLogoBase64 = canvas.toDataURL("image/png");
      resolve(cachedLogoBase64);
    };
    img.onerror = () => resolve("");
    img.src = logoSrc;
  });
};

export const generatePDFFromContainer = async (
  container: HTMLDivElement,
  fileName: string
) => {
  // Container is already positioned off-screen by parent wrapper
  // Just ensure it's visible and wait for layout
  await new Promise((r) => setTimeout(r, 600));

  const pdf = new jsPDF("l", "mm", "a4");
  const pdfWidth = 297;
  const pdfHeight = 210;
  const margin = 6;
  const contentWidth = pdfWidth - margin * 2;

  const sections = container.querySelectorAll<HTMLElement>(":scope > div");

  for (let i = 0; i < sections.length; i++) {
    if (i > 0) pdf.addPage();

    const canvas = await html2canvas(sections[i], {
      scale: 2,
      useCORS: true,
      backgroundColor: "#ffffff",
      logging: false,
    });

    const imgData = canvas.toDataURL("image/png");
    const imgHeight = (canvas.height * contentWidth) / canvas.width;

    pdf.addImage(
      imgData,
      "PNG",
      margin,
      margin,
      contentWidth,
      Math.min(imgHeight, pdfHeight - margin * 2)
    );
  }

  pdf.save(fileName);
};

export const formatCpf = (cpf: string) =>
  cpf.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4");

export const formatDateBR = (dateStr: string | null | undefined) => {
  if (!dateStr) return "—";
  try {
    const d = new Date(dateStr + "T12:00:00");
    if (isNaN(d.getTime())) return "—";
    return format(d, "dd/MM", { locale: undefined });
  } catch {
    return "—";
  }
};

export const formatCurrency = (val: number | null | undefined) => {
  if (val === null || val === undefined || isNaN(val)) return "R$ 0,00";
  return val.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
};
