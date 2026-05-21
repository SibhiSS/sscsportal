import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { supabase } from '@/lib/supabase';
import { DepartmentWeights } from '@/types';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Badge } from '@/components/ui/badge';
import HolographicCard from '@/components/ui/HolographicCard';
import { Save, RefreshCw, Info, BarChart3, MessageSquare, Cpu, Zap, Crown, Users } from 'lucide-react';

interface DeptWeightsEditorProps {
    userEmail: string;
}

const METRIC_CONFIG = [
    { key: 'metric_weight_communication' as const, label: 'Communication', icon: MessageSquare, color: 'text-blue-400' },
    { key: 'metric_weight_technical' as const, label: 'Technical Knowledge', icon: Cpu, color: 'text-cyan-400' },
    { key: 'metric_weight_enthusiasm' as const, label: 'Enthusiasm', icon: Zap, color: 'text-yellow-400' },
    { key: 'metric_weight_leadership' as const, label: 'Leadership Potential', icon: Crown, color: 'text-orange-400' },
    { key: 'metric_weight_team_fit' as const, label: 'Team Fit', icon: Users, color: 'text-green-400' },
];

const COMPONENT_CONFIG = [
    { key: 'weight_resume' as const, label: 'Resume / Profile', color: '#3b82f6' },
    { key: 'weight_task' as const, label: 'Task / Portfolio', color: '#f59e0b' },
    { key: 'weight_interview' as const, label: 'Interview Score', color: '#dc143c' },
];

export default function DeptWeightsEditor({ userEmail }: DeptWeightsEditorProps) {
    const [weights, setWeights] = useState<DepartmentWeights[]>([]);
    const [selectedDept, setSelectedDept] = useState<string>('');
    const [localWeights, setLocalWeights] = useState<Partial<DepartmentWeights>>({});
    const [isSaving, setSaving] = useState(false);
    const [isLoading, setLoading] = useState(true);
    const [savedDept, setSavedDept] = useState<string | null>(null);

    useEffect(() => {
        fetchWeights();
    }, []);

    const fetchWeights = async () => {
        setLoading(true);
        const { data } = await supabase.from('department_weights').select('*').order('department');
        if (data && data.length > 0) {
            setWeights(data as DepartmentWeights[]);
            setSelectedDept(data[0].department);
            setLocalWeights(data[0]);
        }
        setLoading(false);
    };

    const handleDeptSelect = (dept: string) => {
        setSelectedDept(dept);
        const found = weights.find(w => w.department === dept);
        if (found) setLocalWeights({ ...found });
    };

    const updateComponentWeight = (key: keyof DepartmentWeights, rawValue: number) => {
        // Normalize: the 3 component weights must sum to 1.0
        const current = { ...localWeights } as any;
        const others = COMPONENT_CONFIG.filter(c => c.key !== key).map(c => c.key);
        const newVal = Math.round(rawValue) / 100;
        const remaining = 1.0 - newVal;
        const otherSum = others.reduce((s: number, k: string) => s + (current[k] || 0), 0);

        if (otherSum === 0) {
            const split = remaining / others.length;
            others.forEach((k: string) => { current[k] = Math.round(split * 100) / 100; });
        } else {
            others.forEach((k: string) => {
                current[k] = Math.round(((current[k] / otherSum) * remaining) * 100) / 100;
            });
        }
        current[key] = newVal;
        setLocalWeights(current);
    };

    const updateMetricWeight = (key: keyof DepartmentWeights, rawValue: number) => {
        const current = { ...localWeights } as any;
        const others = METRIC_CONFIG.filter(c => c.key !== key).map(c => c.key);
        const newVal = Math.round(rawValue) / 100;
        const remaining = 1.0 - newVal;
        const otherSum = others.reduce((s: number, k: string) => s + (current[k] || 0), 0);

        if (otherSum === 0) {
            const split = remaining / others.length;
            others.forEach((k: string) => { current[k] = Math.round(split * 100) / 100; });
        } else {
            others.forEach((k: string) => {
                current[k] = Math.round(((current[k] / otherSum) * remaining) * 100) / 100;
            });
        }
        current[key] = newVal;
        setLocalWeights(current);
    };

    const handleSave = async () => {
        if (!selectedDept) return;
        setSaving(true);
        const { error } = await supabase
            .from('department_weights')
            .upsert({
                ...localWeights,
                department: selectedDept,
                updated_by: userEmail,
                updated_at: new Date().toISOString(),
            }, { onConflict: 'department' });

        if (!error) {
            setSavedDept(selectedDept);
            setTimeout(() => setSavedDept(null), 2000);
            fetchWeights();
        }
        setSaving(false);
    };

    const resetToDefault = () => {
        const defaults: Partial<DepartmentWeights> = {
            metric_weight_communication: 0.20,
            metric_weight_technical: 0.20,
            metric_weight_enthusiasm: 0.20,
            metric_weight_leadership: 0.20,
            metric_weight_team_fit: 0.20,
            weight_resume: 0.20,
            weight_task: 0.35,
            weight_interview: 0.45,
        };
        setLocalWeights(prev => ({ ...prev, ...defaults }));
    };

    const componentSum = COMPONENT_CONFIG.reduce((s, c) => s + ((localWeights as any)[c.key] || 0), 0);
    const metricSum = METRIC_CONFIG.reduce((s, m) => s + ((localWeights as any)[m.key] || 0), 0);

    if (isLoading) {
        return (
            <div className="flex items-center justify-center h-48">
                <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
            </div>
        );
    }

    return (
        <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-6"
        >
            <div className="flex items-center justify-between">
                <div>
                    <h3 className="text-lg font-bold text-white">Department Scoring Weights</h3>
                    <p className="text-xs text-muted-foreground mt-1">
                        Customize how final scores are weighted per department. All values auto-normalize to 100%.
                    </p>
                </div>
                <div className="flex items-center gap-2 text-[10px] text-muted-foreground bg-white/5 border border-white/10 rounded-lg px-3 py-2">
                    <Info className="w-3 h-3" />
                    <span>Changes apply to future ranking calculations</span>
                </div>
            </div>

            {/* Dept Selector */}
            <div className="flex flex-wrap gap-2">
                {weights.map(w => (
                    <button
                        key={w.department}
                        onClick={() => handleDeptSelect(w.department)}
                        className={`px-4 py-1.5 rounded-full text-xs font-bold tracking-wider transition-all border ${
                            selectedDept === w.department
                                ? 'bg-primary text-white border-primary shadow-lg shadow-primary/20'
                                : 'bg-white/5 border-white/10 text-muted-foreground hover:border-white/20 hover:text-white'
                        }`}
                    >
                        {w.department}
                        {savedDept === w.department && (
                            <span className="ml-2 text-green-400">✓</span>
                        )}
                    </button>
                ))}
            </div>

            {selectedDept && (
                <div className="grid lg:grid-cols-2 gap-6">
                    {/* Component Weights */}
                    <HolographicCard className="p-6 border-white/5">
                        <div className="flex items-center gap-2 mb-5">
                            <BarChart3 className="w-4 h-4 text-primary" />
                            <h4 className="text-sm font-bold text-white">Component Weights</h4>
                            <Badge
                                variant="outline"
                                className={`ml-auto text-[10px] ${Math.abs(componentSum - 1.0) < 0.01 ? 'text-green-400 border-green-400/30' : 'text-red-400 border-red-400/30'}`}
                            >
                                {Math.round(componentSum * 100)}% total
                            </Badge>
                        </div>
                        <div className="space-y-5">
                            {COMPONENT_CONFIG.map(comp => {
                                const val = Math.round(((localWeights as any)[comp.key] || 0) * 100);
                                return (
                                    <div key={comp.key} className="space-y-2">
                                        <div className="flex justify-between text-xs">
                                            <span className="text-muted-foreground font-medium">{comp.label}</span>
                                            <span className="font-bold text-white font-mono">{val}%</span>
                                        </div>
                                        <Slider
                                            min={5} max={80} step={5}
                                            value={[val]}
                                            onValueChange={([v]) => updateComponentWeight(comp.key, v)}
                                            className="w-full"
                                        />
                                    </div>
                                );
                            })}
                        </div>
                    </HolographicCard>

                    {/* Interview Metric Weights */}
                    <HolographicCard className="p-6 border-white/5">
                        <div className="flex items-center gap-2 mb-5">
                            <Users className="w-4 h-4 text-purple-400" />
                            <h4 className="text-sm font-bold text-white">Interview Metric Weights</h4>
                            <Badge
                                variant="outline"
                                className={`ml-auto text-[10px] ${Math.abs(metricSum - 1.0) < 0.01 ? 'text-green-400 border-green-400/30' : 'text-red-400 border-red-400/30'}`}
                            >
                                {Math.round(metricSum * 100)}% total
                            </Badge>
                        </div>
                        <div className="space-y-5">
                            {METRIC_CONFIG.map(metric => {
                                const Icon = metric.icon;
                                const val = Math.round(((localWeights as any)[metric.key] || 0) * 100);
                                return (
                                    <div key={metric.key} className="space-y-2">
                                        <div className="flex justify-between text-xs">
                                            <span className={`flex items-center gap-1.5 font-medium ${metric.color}`}>
                                                <Icon className="w-3 h-3" />
                                                {metric.label}
                                            </span>
                                            <span className="font-bold text-white font-mono">{val}%</span>
                                        </div>
                                        <Slider
                                            min={5} max={60} step={5}
                                            value={[val]}
                                            onValueChange={([v]) => updateMetricWeight(metric.key, v)}
                                            className="w-full"
                                        />
                                    </div>
                                );
                            })}
                        </div>
                    </HolographicCard>
                </div>
            )}

            {/* Save Actions */}
            <div className="flex items-center justify-end gap-3 pt-2">
                <Button
                    variant="outline"
                    size="sm"
                    onClick={resetToDefault}
                    className="border-white/10 text-muted-foreground hover:text-white text-xs"
                >
                    <RefreshCw className="w-3 h-3 mr-2" />
                    Reset to Default
                </Button>
                <Button
                    size="sm"
                    onClick={handleSave}
                    disabled={isSaving}
                    className="bg-primary hover:bg-primary/90 text-white text-xs shadow-lg shadow-primary/20"
                >
                    {isSaving
                        ? <><div className="w-3 h-3 border border-white border-t-transparent rounded-full animate-spin mr-2" />Saving...</>
                        : <><Save className="w-3 h-3 mr-2" />Save Weights for {selectedDept}</>
                    }
                </Button>
            </div>
        </motion.div>
    );
}
