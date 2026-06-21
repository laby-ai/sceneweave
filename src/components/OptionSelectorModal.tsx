import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogClose,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { CheckCircle2, X } from 'lucide-react';

interface OptionItem {
  value: string;
  label: string;
  description?: string;
  icon?: React.ReactNode;
  disabled?: boolean;
}

interface OptionSelectorModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  options: OptionItem[];
  selectedValue?: string;
  onSelect: (value: string) => void;
  excludeValues?: string[];
  showExcluded?: boolean;
}

export function OptionSelectorModal({
  open,
  onOpenChange,
  title,
  description,
  options,
  selectedValue,
  onSelect,
  excludeValues = [],
  showExcluded = false,
}: OptionSelectorModalProps) {
  const handleSelect = (value: string) => {
    onSelect(value);
    onOpenChange(false);
  };

  // 过滤掉已选过的选项（除非 showExcluded 为 true）
  const availableOptions = options.filter(opt => {
    if (showExcluded) return true;
    return !excludeValues.includes(opt.value);
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {description && <DialogDescription>{description}</DialogDescription>}
        </DialogHeader>
        
        <ScrollArea className="max-h-[400px] pr-4">
          <div className="space-y-2">
            {availableOptions.length === 0 ? (
              <div className="py-8 text-center text-muted-foreground">
              没有更多可选选项
            </div>
            ) : (
              availableOptions.map((option) => (
                <button
                  key={option.value}
                  onClick={() => !option.disabled && handleSelect(option.value)}
                  disabled={option.disabled}
                  className={`w-full text-left p-4 rounded-lg border-2 transition-all hover:bg-muted hover:border-primary/30 hover:scale-[1.01] ${
                    selectedValue === option.value
                      ? 'border-primary bg-primary/5'
                      : 'border-border'
                  } ${option.disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
                >
                  <div className="flex items-start gap-3">
                    {option.icon}
                    <div className="flex-1">
                      <div className="flex items-center justify-between">
                        <span className="font-medium">
                          {option.label}
                        </span>
                        {selectedValue === option.value && (
                          <CheckCircle2 className="w-4 h-4 text-primary" />
                        )}
                      </div>
                      {option.description && (
                        <p className="text-sm text-muted-foreground mt-1">
                          {option.description}
                        </p>
                      )}
                    </div>
                  </div>
                </button>
              ))
            )}
          </div>
        </ScrollArea>
        
        <div className="flex justify-end gap-2">
          <DialogClose asChild>
            <Button variant="secondary">
              <X className="w-4 h-4 mr-2" />
              取消
            </Button>
          </DialogClose>
        </div>
      </DialogContent>
    </Dialog>
  );
}
