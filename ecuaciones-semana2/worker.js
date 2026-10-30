importScripts('vendor/nerdamer.min.js','solver.js');
onmessage=event=>{try{postMessage({ok:true,result:ExactSolver.solve(event.data.M,event.data.N)})}catch(e){postMessage({ok:false,error:e.message||'No se pudo analizar la expresión.'})}};
