"use client";
import { useCustomerOrderStats } from "./useCustomerOrderStats";
export function useCustomerOrderCount(){
 const stats=useCustomerOrderStats();
 return {count:stats.total,loading:stats.loading,error:stats.error};
}
