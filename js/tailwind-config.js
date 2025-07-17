// Tailwind configuration
tailwind.config = {
    darkMode: 'class', // Habilitando o modo escuro baseado em classe
    theme: {
        extend: {
            fontFamily: {
                'sans': ['Poppins', 'sans-serif'],
                'anton': ['Anton', 'sans-serif'],
            },
            colors: {
                'brand': {
                    'blue': '#29aae2',
                    'dark-blue': '#2397cf',
                    'text': '#334155',
                    'light-gray': '#f1f5f9',
                    'background': '#f8fafc'
                }
            }
        }
    }
}
