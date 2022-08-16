// Toggle element active state
function toggle(el, force = undefined) {
  if (el) {
    const active = el.classList.toggle('active', force)
    el.setAttribute('style', active ? '' : 'height: 0px')
  }
}

// Collapsable articles
const articles = document.querySelectorAll('article')
articles.forEach((article) => {
  const body = article.querySelector('.body')
  toggle(body, false)
  article.onclick = () => {
    toggle(body)
  }
})

// Expand article and scroll to it on link click
const links = document.querySelectorAll('#sidebar a')
links.forEach((link) => {
  const id = link.getAttribute('href').substring(1)
  link.onclick = () => {
    const header = document.getElementById(id)
    const article = header.closest('article')
    if (article) {
      const body = article.querySelector('.body')
      toggle(body, true)
    }
    
    (article || header).scrollIntoView({
      behavior: 'smooth',
    })
  }

  const otherLinks = document.querySelectorAll(`.body a[href="#${id}"]`)
  otherLinks.forEach((otherLink) => {
    otherLink.onclick = () => {
      link.click()
    }
  })
})

// show/hide all articles
const show = document.querySelector('button.control.show')
const hide = document.querySelector('button.control.hide')
show.onclick = () => {
  articles.forEach((article) => {
    const body = article.querySelector('.body')
    toggle(body, true)
  })
}

hide.onclick = () => {
  articles.forEach((article) => {
    const body = article.querySelector('.body')
    toggle(body, false)
  })
}


// On page load go to the article that is in the URL
window.onload = () => {
  const id = window.location.hash.substring(1)
  if (id) {
    const link = document.querySelector(`#sidebar a[href="#${id}"]`)
    link.click()
  }
}
