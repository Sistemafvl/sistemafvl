import logo from "@/assets/logo.png";
import { useTripleClick } from "@/hooks/use-triple-click";

interface LogoHeaderProps {
  onTripleClick?: () => void;
  size?: "sm" | "md" | "lg" | "xl";
}

const sizeClasses = {
  sm: "h-10 sm:h-12",
  md: "h-16 sm:h-20",
  lg: "h-24 sm:h-32",
  xl: "h-24 sm:h-40",
};

const LogoHeader = ({ onTripleClick, size = "md" }: LogoHeaderProps) => {
  const handleClick = useTripleClick({
    onTripleClick: onTripleClick || (() => {}),
  });

  return (
    <div
      className="flex items-center justify-center cursor-pointer select-none"
      onClick={handleClick}
    >
      <img
        src={logo}
        alt="Sistema FVL"
        className={`${sizeClasses[size]} w-auto object-contain`}
        draggable={false}
      />
    </div>
  );
};

export default LogoHeader;
