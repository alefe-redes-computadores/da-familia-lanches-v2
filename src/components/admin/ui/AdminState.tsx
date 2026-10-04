import { AlertTriangle, LoaderCircle, RotateCcw } from "lucide-react";

export function AdminLoadingState({label="Carregando painel",compact=false}:{label?:string;compact?:boolean}) {
  return <div className="adminState" data-kind="loading" data-compact={compact} role="status" aria-live="polite">
    <span className="adminStateIcon"><LoaderCircle size={19} className="adminGlobalSpinner"/></span>
    <span><strong>{label}</strong><small>Preparando os dados sem alterar sua operação.</small></span>
    <div className="adminSkeletonLines" aria-hidden="true"><i/><i/><i/></div>
  </div>
}

export function AdminErrorState({title="Não foi possível carregar",message,onRetry}:{title?:string;message:string;onRetry?:()=>void}) {
  return <div className="adminState" data-kind="error" role="alert">
    <span className="adminStateIcon"><AlertTriangle size={19}/></span>
    <span><strong>{title}</strong><small>{message}</small></span>
    {onRetry?<button type="button" onClick={onRetry}><RotateCcw size={15}/>Tentar novamente</button>:null}
  </div>
}
