import React from 'react';
import { useNavigate } from 'react-router-dom';
import type { ActionCenterItem } from '../domain/actionCenterTypes';
import { 
  Info as AlertCircle, 
  ArrowForward as ArrowRight, 
  CheckCircle as CheckCircle2, 
  Assignment as ClipboardList, 
  Warning as AlertTriangle,
  Thermostat as ThermostatIcon,
  LocalShipping as TransportIcon,
  Description as PlanningIcon
} from '@mui/icons-material';

interface ActionCenterWidgetProps {
  actions: ActionCenterItem[];
  isLoading?: boolean;
}

/**
 * ActionCenterWidget
 * 
 * Today Hub の最上部に位置する「決断カード」群。
 * 未完了のタスクを優先度順に並べ、次の行動を促す。
 */
export const ActionCenterWidget: React.FC<ActionCenterWidgetProps> = ({ 
  actions, 
  isLoading 
}) => {
  const navigate = useNavigate();

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 animate-pulse">
        {[1, 2].map((i) => (
          <div key={i} className="h-24 bg-gray-100 dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700" />
        ))}
      </div>
    );
  }

  if (actions.length === 0) {
    return (
      <div className="flex items-center gap-3 p-4 bg-green-50 dark:bg-green-900/20 border border-green-100 dark:border-green-900/30 rounded-xl">
        <div className="p-2 bg-green-100 dark:bg-green-800 rounded-full">
          <CheckCircle2 className="w-5 h-5 text-green-600 dark:text-green-400" />
        </div>
        <div>
          <p className="font-semibold text-green-800 dark:text-green-300">本日の入力はすべて完了しています</p>
          <p className="text-sm text-green-600 dark:text-green-400">お疲れ様でした。現場は順調に稼働しています。</p>
        </div>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {actions.map((action) => (
        <button
          key={action.id}
          onClick={() => navigate(action.href)}
          className={`
            group relative flex flex-col justify-between p-4 text-left transition-all duration-300
            bg-white dark:bg-gray-900 border-2 rounded-2xl shadow-sm hover:shadow-md hover:-translate-y-1
            ${action.priority === 'critical' ? 'border-red-200 dark:border-red-900/50 hover:border-red-400' : 
              action.priority === 'high' ? 'border-orange-200 dark:border-orange-900/50 hover:border-orange-400' : 
              'border-blue-200 dark:border-blue-900/50 hover:border-blue-400'}
          `}
        >
          <div className="flex items-start justify-between mb-2">
            <div className={`
              p-2 rounded-lg
              ${action.priority === 'critical' ? 'bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-400' : 
                action.priority === 'high' ? 'bg-orange-50 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400' : 
                'bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400'}
            `}>
              {action.kind === 'daily' ? <ClipboardList className="w-5 h-5" /> : 
               action.kind === 'handoff' ? <AlertCircle className="w-5 h-5" /> : 
               action.kind === 'vital' ? <ThermostatIcon className="w-5 h-5" /> :
               action.kind === 'transport' ? <TransportIcon className="w-5 h-5" /> :
               action.kind === 'planning' ? <PlanningIcon className="w-5 h-5" /> :
               <AlertTriangle className="w-5 h-5" />}
            </div>
            
            <span className={`
              text-2xl font-black tracking-tighter
              ${action.count > 0 ? 'text-gray-900 dark:text-white' : 'text-gray-400'}
            `}>
              {action.count}<span className="text-sm ml-1 font-bold text-gray-500">{action.unit}</span>
            </span>
          </div>

          <div>
            <h3 className="font-bold text-gray-900 dark:text-white mb-1 group-hover:text-primary transition-colors">
              {action.title}
            </h3>
            <div className="flex items-center text-sm font-medium text-primary-600 dark:text-primary-400">
              {action.actionLabel}
              <ArrowRight className="w-4 h-4 ml-1 transition-transform group-hover:translate-x-1" />
            </div>
          </div>

          {/* 装飾用背景パターン: 優先度に応じたグラデーション */}
          <div className={`
            absolute top-0 right-0 w-24 h-24 bg-gradient-to-br opacity-[0.03] rounded-tr-2xl pointer-events-none
            ${action.priority === 'critical' ? 'from-red-600 to-transparent' : 
              action.priority === 'high' ? 'from-orange-600 to-transparent' : 
              'from-blue-600 to-transparent'}
          `} />
        </button>
      ))}
    </div>
  );
};
