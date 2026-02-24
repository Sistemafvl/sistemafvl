import { HelpCircle } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

const InfoButton = ({ text }: { text: string }) => (
  <Popover>
    <PopoverTrigger asChild>
      <button className="ml-1 inline-flex items-center text-muted-foreground hover:text-primary transition-colors">
        <HelpCircle className="h-3.5 w-3.5" />
      </button>
    </PopoverTrigger>
    <PopoverContent className="text-xs max-w-[260px] p-3">{text}</PopoverContent>
  </Popover>
);

export default InfoButton;
