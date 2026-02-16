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
  container.style.position = "absolute";
  container.style.left = "-9999px";
  container.style.top = "0";
  container.style.display = "block";
  container.style.width = "1122px";

  await new Promise((r) => setTimeout(r, 400));

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
  container.style.display = "none";
};

export const formatCpf = (cpf: string) =>
  cpf.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4");

export const formatDateBR = (dateStr: string) =>
  format(new Date(dateStr + "T12:00:00"), "dd/MM", { locale: undefined });

export const formatCurrency = (val: number) =>
  `R$ ${val.toFixed(2).replace(".", ",")}`;
