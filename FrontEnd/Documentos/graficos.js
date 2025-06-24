    const API_BASE_URL = 'http://localhost:3000/api';

    async function fetchCounts(year) {
        const endpoints = [
            { label: 'Contratos', endpoint: `contracts/count?year=${year}` },
            { label: 'Projetos', endpoint: `projects/count?year=${year}` },
            { label: 'Identidades', endpoint: `identities/count?year=${year}` }
        ];
        const results = [];
        for (const item of endpoints) {
            try {
                const res = await fetch(`${API_BASE_URL}/${item.endpoint}`);
                const data = await res.json();
                results.push(data.count || 0);
            } catch {
                results.push(0);
            }
        }
        return results;
    }

let chart;

async function renderDashboard(year) {
    const counts = await fetchCounts(year);
    const ctx = document.getElementById('dashboardChart').getContext('2d');
    
    if (chart && typeof chart.destroy === 'function') {
        chart.destroy();
    }

    if (!ctx) {
        console.error('Canvas context não encontrado')
        return
    }


    // Dados para o gráfico
    const data = {
        labels: ['Contratos', 'Projetos', 'Identidades'],
        datasets: [{
            label: `Registros em ${year}`,
            data: counts,
            backgroundColor: [
                'rgba(40, 167, 69, 0.7)',  // Contratos - verde com transparência
                'rgba(247, 174, 38, 0.7)',  // Projetos - laranja com transparência
                'rgba(249, 41, 41, 0.7)'    // Identidades - vermelho com transparência
            ],
            borderColor: [
                'rgba(40, 167, 69, 1)',     // Bordas mais escuras
                'rgba(247, 174, 38, 1)',
                'rgba(249, 41, 41, 1)'
            ],
            borderWidth: 2,
            borderRadius: 4,                 // Cantos arredondados
            hoverBackgroundColor: [
                'rgba(40, 167, 69, 1)',     // Cores mais vibrantes ao passar mouse
                'rgba(247, 174, 38, 1)',
                'rgba(249, 41, 41, 1)'
            ],
            hoverBorderWidth: 3
        }]
    };

    // Configurações do gráfico
    const options = {
        responsive: true,
        maintainAspectRatio: false,          // Permite ajustar livremente
        plugins: {
            legend: { 
                onClick: null,
                display: true,
                position: 'top',
                labels: {
                    generateLabels: function(chart) {
                    // Retorna apenas o label personalizado sem ícone
                    return [{
                        text: `Registros ${year}`,  // Texto dinâmico com o ano
                        fillStyle: 'transparent',    // Remove o retângulo de cor
                        strokeStyle: 'transparent',  // Remove borda
                        fontColor: '#333',          // Cor do texto
                        hidden: false,
                        lineWidth: 0                // Remove linha                
                }]
             }
        }
    },
        
            title: { 
                display: true, 
                text: `DOCUMENTOS REGISTRADOS - ${year}`,
                color: '#2c3e50',
                font: {
                    size: 18,
                    weight: 'bold',
                    family: "'Segoe UI', Tahoma, Geneva, Verdana, sans-serif"
                },
                padding: {
                    top: 10,
                    bottom: 30
                }
            },
            tooltip: {
                backgroundColor: 'rgba(0, 0, 0, 0.8)',
                titleFont: {
                    size: 14,
                    weight: 'bold'
                },
                bodyFont: {
                    size: 12
                },
                padding: 12,
                cornerRadius: 4,
                displayColors: true,
                callbacks: {
                    label: function(context) {
                        return `${context.dataset.label}: ${context.raw.toLocaleString()}`;
                    }
                }
            }
        },
        scales: {
            y: {
                beginAtZero: true,
                grid: {
                    color: 'rgba(0, 0, 0, 0.05)',
                    drawBorder: false
                },
                ticks: {
                    color: '#7f8c8d',
                    precision: 0,
                    callback: function(value) {
                        return value.toLocaleString(); // Formata números com separadores
                    }
                },
                title: {
                    display: true,
                    text: 'Quantidade de Registros',
                    color: '#7f8c8d',
                    font: {
                        size: 13
                    }
                }
            },
            x: {
                grid: {
                    display: false
                },
                ticks: {
                    color: '#2c3e50',
                    font: {
                        weight: 'bold'
                    }
                }
            }
        },
        animation: {
            duration: 1000,
            easing: 'easeInOutQuad'
        },
        interaction: {
            intersect: false,
            mode: 'index'
        }
    };

    // Criar o novo gráfico
    chart = new Chart(ctx, {
        type: 'bar',
        data: data,
        options: options
    });

        if( !chart || chart === null) {
        console.warn('Gráfico não está inicializado')
        return;
    } 

}    

document.getElementById('yearSelect').addEventListener('change', function() {
        renderDashboard(this.value);
    });

document.getElementById('downloadChart').addEventListener('click', async () => {
  const token = localStorage.getItem('token');
  const year = document.getElementById('yearSelect').value;

  try {
    const response = await fetch('http://localhost:3000/api/generate-chart', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ year })
    });

    if (!response.ok) {
      throw new Error('Erro ao gerar gráfico');
    }

    const data = await response.json();

    // Verifique se a resposta contém a imagem em base64
    if (!data.image) {
      throw new Error('Resposta inválida do servidor');
    }

    // Cria o link de download
    const link = document.createElement('a');
    link.href = `data:image/png;base64,${data.image}`; // Prefixo correto para base64
    link.download = `dashboard-${year}.png`;
    link.click();

  } catch (error) {
    console.error('Erro:', error);
    alert('Falha ao baixar o gráfico: ' + error.message);
  }
});

// Inicialização
    renderDashboard(document.getElementById('yearSelect').value);
