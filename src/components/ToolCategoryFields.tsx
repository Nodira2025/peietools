import { Label } from './ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { classifyTool, compareCategories, compareSubcategories, defaultSubcategory, serializeClassification, type TaxonomyTool, type ToolCategory } from '../lib/toolTaxonomy';

interface Props {
  id: string;
  value: string;
  onChange: (value: string) => void;
  catalog: ToolCategory[];
  tool?: TaxonomyTool;
}

export default function ToolCategoryFields({ id, value, onChange, catalog, tool }: Props) {
  const selected = classifyTool({ ...tool, category: value });
  const categories = [...new Set([...catalog.map(c => c.name), selected.category])].sort(compareCategories);
  const subcategories = [...new Set([...(catalog.find(c => c.name === selected.category)?.subcategories || []), selected.subcategory])].sort(compareSubcategories);
  return <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
    <div className="space-y-1.5">
      <Label htmlFor={`${id}-category`} className="text-xs font-semibold text-slate-700">Categoría principal *</Label>
      <Select value={selected.category} onValueChange={category => onChange(serializeClassification({ category, subcategory: defaultSubcategory(category) }))}>
        <SelectTrigger id={`${id}-category`} className="h-11 rounded-xl"><SelectValue /></SelectTrigger>
        <SelectContent>{categories.map(category => <SelectItem key={category} value={category}>{category}</SelectItem>)}</SelectContent>
      </Select>
    </div>
    <div className="space-y-1.5">
      <Label htmlFor={`${id}-subcategory`} className="text-xs font-semibold text-slate-700">Subcategoría *</Label>
      <Select value={selected.subcategory} onValueChange={subcategory => onChange(serializeClassification({ ...selected, subcategory }))}>
        <SelectTrigger id={`${id}-subcategory`} className="h-11 rounded-xl"><SelectValue /></SelectTrigger>
        <SelectContent>{subcategories.map(subcategory => <SelectItem key={subcategory} value={subcategory}>{subcategory}</SelectItem>)}</SelectContent>
      </Select>
    </div>
  </div>;
}
