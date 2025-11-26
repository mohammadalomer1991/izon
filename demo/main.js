function MoveToMenu(){
    // Show the loader
    document.getElementById('loader').style.display = 'flex';   
    
    // Wait 5 seconds then navigate to the next page
    setTimeout(() => {
        window.location.href = 'http://localhost:5550/menu.html';
    }, 5000); // 5000 milliseconds = 5 seconds
}