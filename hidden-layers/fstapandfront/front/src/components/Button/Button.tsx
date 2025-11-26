import  styles from './button.module.scss'

interface ButtonProps{
    onClick: () => void
}
export const Button =(props:ButtonProps)=>{
    const getUserName =()=>{
        props.onClick()

    }
    return <button onClick={getUserName} className={styles['c-button']}> Display Name</button>
}