const API_BASE = "/api"

let mode = "full"

const situation = document.getElementById("situation")
const analyzeBtn = document.getElementById("analyzeBtn")
const statusBox = document.getElementById("status")
const result = document.getElementById("result")
const analysisText = document.getElementById("analysisText")

document.querySelectorAll(".mode").forEach(btn=>{
btn.addEventListener("click",()=>{

document.querySelectorAll(".mode").forEach(b=>b.classList.remove("active"))

btn.classList.add("active")

mode = btn.dataset.mode

})
})

analyzeBtn.addEventListener("click", analyze)

async function analyze(){

const text = situation.value.trim()

if(!text){

statusBox.textContent="Najpierw opisz sytuację."

return

}

statusBox.textContent="STAN analizuje..."

try{

const res = await fetch(API_BASE+"/analyze",{

method:"POST",

headers:{
"Content-Type":"application/json"
},

body:JSON.stringify({

situation:text,

mode:mode

})

})

const data = await res.json()

analysisText.innerText = data.analysis || "Brak analizy"

result.classList.remove("hidden")

statusBox.textContent="Analiza gotowa."

}catch(e){

statusBox.textContent="Błąd analizy."

}

}
}
