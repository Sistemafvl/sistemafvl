import logo from "@/assets/logo.png";
import { useTripleClick } from "@/hooks/use-triple-click";

interface LogoHeaderProps {
  onTripleClick?: () => void;
  size?: "sm" | "md" | "lg";
}

const sizeClasses = {
  sm: "h-12",
  md: "h-20",
  lg: "h-32",
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
