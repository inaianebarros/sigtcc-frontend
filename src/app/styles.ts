export const textFieldStyle = {
    textFieldFilledStyle: {
        '& .MuiFilledInput-root': {
            backgroundColor: 'transparent',
            '&:hover': {
                backgroundColor: 'transparent',
            },
            '&.Mui-focused': {
                backgroundColor: 'transparent'
            }
        }
    },
    textFieldOutlinedStyle: {
        '& .MuiOutlinedInput-root': {
            '& fieldset': {
                borderColor: 'transparent',
            },
            '&:hover fieldset': {
                borderColor: 'transparent',
            },
            '&.Mui-focused fieldset': {
                borderColor: 'transparent',
            },
        }
    },

    fontSize: { sx: { fontSize: 20 } },
}

export const chipColors = ['#DAB0E8', '#BFE8B0', '#A6C5EE', '#B9D9B9'];