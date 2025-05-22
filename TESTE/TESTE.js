function setActive(element) {
    // Remove a classe 'active' de todos os links dentro da .sidenav
    var links = document.querySelectorAll('.sidenav a');
    links.forEach(link => {
        link.classList.remove('active');
    });

    // Adiciona a classe 'active' ao link clicado
    element.classList.add('active');
}

document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', function (e) {
        e.preventDefault(); // Evita o comportamento padrão do link

        const targetId = this.getAttribute('href'); // Pega o ID do alvo
        const targetElement = document.querySelector(targetId); // Seleciona o elemento alvo

        if (targetElement) {
            targetElement.scrollIntoView({
                behavior: 'smooth', 
                block: 'start' // Alinha o topo do elemento com a parte superior da janela
            });
        }
    });
});

window.onscroll = function() {
    const setaBaixo = document.getElementById('setaBaixo');
    const setaCima = document.getElementById('setaCima');
    const scrollTop = document.documentElement.scrollTop || document.body.scrollTop;
    const scrollHeight = document.documentElement.scrollHeight || document.body.scrollHeight;
    const clientHeight = document.documentElement.clientHeight || document.body.clientHeight;


    if (scrollTop > 20) {
        setaCima.style.display = 'flex'; // Mostra a seta para cima
    } else {
        setaCima.style.display = 'none'; // Oculta a seta para cima
    }

    if (scrollTop + clientHeight >= scrollHeight - 20) {
        setaBaixo.style.opacity = '0'; // Oculta a seta para baixo
        setaBaixo.style.pointerEvents = 'none'; // Desativa interações
    } else {
        setaBaixo.style.opacity = '1'; // Mostra a seta para baixo
        setaBaixo.style.pointerEvents = 'auto'; // Ativa interações
    }
};

document.getElementById('setaCima').addEventListener('click', function() {
    window.scrollTo({
        top: 0,
        behavior: 'smooth'
    });
});