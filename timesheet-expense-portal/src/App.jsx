
import React, { useState, useMemo } from "react";
import { Clock, FileCheck2, TrendingUp, WalletCards, CheckCircle2, CalendarDays } from "lucide-react";

const weekDays = ["Mon","Tue","Wed","Thu","Fri"];

export default function App(){

  const [tab,setTab]=useState("dashboard");

  const [timesheet,setTimesheet]=useState({
    Mon:{projectHours:"",travelHours:"",workshopHours:""},
    Tue:{projectHours:"",travelHours:"",workshopHours:""},
    Wed:{projectHours:"",travelHours:"",workshopHours:""},
    Thu:{projectHours:"",travelHours:"",workshopHours:""},
    Fri:{projectHours:"",travelHours:"",workshopHours:""},
  });

  const [expenses,setExpenses]=useState([{amount:""}]);

  const standardHours = 7.5;

  const totals = useMemo(()=>{
    let hours=0, til=0, expense=0;

    weekDays.forEach(d=>{
      const r=timesheet[d];
      const worked = Number(r.projectHours||0)+Number(r.travelHours||0)+Number(r.workshopHours||0);
      hours+=worked;
      til+=Math.max(0,worked-standardHours);
    });

    expenses.forEach(e=>{
      expense+=Number(e.amount||0);
    });

    return {hours,til,expense};
  },[timesheet,expenses]);

  return (
    <div style={{padding:20}}>
 
      {/* TABS */}
      <div>
        {["dashboard","timesheet","expense"].map(t=>
          <button key={t} onClick={()=>setTab(t)} style={{marginRight:10}}>
            {t}
          </button>
        )}
      </div>

      {/* DASHBOARD */}
      {tab==="dashboard" && (
        <div style={{marginTop:20}}>

          <h2>Hours & TIL Summary</h2>

          <div style={{display:"flex",gap:20}}>
            <Box title="Total Hours" value={totals.hours.toFixed(2)} icon={<Clock/>}/>
            <Box title="Time in Lieu" value={totals.til.toFixed(2)} icon={<FileCheck2/>}/>
            <Box title="This Week OT" value={totals.til.toFixed(2)} icon={<TrendingUp/>}/>
          </div>

          <h2 style={{marginTop:30}}>Expense Summary</h2>

          <div style={{display:"flex",gap:20}}>
            <Box title="Total Expense" value={`£${totals.expense}`} icon={<WalletCards/>}/>
            <Box title="Approved / Paid" value={`£${totals.expense}`} icon={<CheckCircle2/>}/>
            <Box title="Claims Count" value={expenses.length} icon={<CalendarDays/>}/>
          </div>

        </div>
      )}

      {/* TIMESHEET */}
      {tab==="timesheet" && (
        <div style={{marginTop:20}}>
          <h2>Timesheet</h2>

          {weekDays.map(day=>{
            const r=timesheet[day];
            return (
              <div key={day} style={{marginBottom:10}}>
                {day}：
                <input placeholder="Project" value={r.projectHours} onChange={e=>setTimesheet({...timesheet,[day]:{...r,projectHours:e.target.value}})}/>
                <input placeholder="Travel" value={r.travelHours} onChange={e=>setTimesheet({...timesheet,[day]:{...r,travelHours:e.target.value}})}/>
                <input placeholder="Workshop" value={r.workshopHours} onChange={e=>setTimesheet({...timesheet,[day]:{...r,workshopHours:e.target.value}})}/>
              </div>
            );
          })}
        </div>
      )}

      {/* EXPENSE */}
      {tab==="expense" && (
        <div style={{marginTop:20}}>
          <h2>Expense</h2>

          {expenses.map((e,i)=>(
            <div key={i}>
              <input placeholder="Amount" value={e.amount} onChange={ev=>{
                const arr=[...expenses];
                arr[i].amount=ev.target.value;
                setExpenses(arr);
              }}/>
            </div>
          ))}

          <button onClick={()=>setExpenses([...expenses,{amount:""}])}>
            Add
          </button>
        </div>
      )}

    </div>
  );
}

function Box({title,value,icon}){
  return (
    <div style={{border:"1px solid #ddd",padding:10,width:150}}>
      <div>{title}</div>
      <h3>{value}</h3>
      {icon}
    </div>
  );
}
