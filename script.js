document.addEventListener('DOMContentLoaded', () => {
    // Mobile Menu Toggle
    const mobileMenuBtn = document.querySelector('.mobile-menu-btn');
    const nav = document.querySelector('.nav');

    if (mobileMenuBtn) {
        mobileMenuBtn.addEventListener('click', () => {
            nav.classList.toggle('active');
            const icon = mobileMenuBtn.querySelector('i');
            if (nav.classList.contains('active')) {
                icon.classList.remove('fa-bars');
                icon.classList.add('fa-xmark');
            } else {
                icon.classList.remove('fa-xmark');
                icon.classList.add('fa-bars');
            }
        });
    }

    // Smooth Scroll for Anchor Links
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', function (e) {
            e.preventDefault();
            const targetId = this.getAttribute('href');
            if (targetId === '#') return;

            const targetElement = document.querySelector(targetId);
            if (targetElement) {
                // Close mobile menu if open
                if (nav.classList.contains('active')) {
                    nav.classList.remove('active');
                    const icon = mobileMenuBtn.querySelector('i');
                    icon.classList.remove('fa-xmark');
                    icon.classList.add('fa-bars');
                }

                targetElement.scrollIntoView({
                    behavior: 'smooth'
                });
            }
        });
    });

    // Cart Logic
    const cartBtn = document.querySelector('.cart-btn');
    const cartSidebar = document.querySelector('.cart-sidebar');
    const cartOverlay = document.querySelector('.cart-overlay');
    const closeCartBtn = document.querySelector('.close-cart');
    const cartItemsContainer = document.querySelector('.cart-items');
    const cartTotalElement = document.querySelector('.total-amount');
    const cartCountElement = document.querySelector('.cart-count');
    const addToCartBtns = document.querySelectorAll('.product-card .btn');

    let cart = [];

    // Open Cart
    cartBtn.addEventListener('click', (e) => {
        e.preventDefault();
        openCart();
    });

    // Close Cart
    closeCartBtn.addEventListener('click', closeCart);
    cartOverlay.addEventListener('click', closeCart);

    function openCart() {
        cartSidebar.classList.add('active');
        cartOverlay.classList.add('active');
    }

    function closeCart() {
        cartSidebar.classList.remove('active');
        cartOverlay.classList.remove('active');
    }

    // Add to Cart
    addToCartBtns.forEach(btn => {
        btn.addEventListener('click', (e) => {
            const card = e.target.closest('.product-card');
            const title = card.querySelector('h3').textContent;
            const priceText = card.querySelector('.product-price').textContent;
            const price = parseFloat(priceText.replace('S/ ', '').split(' ')[0]);
            const imageSrc = card.querySelector('img').getAttribute('src');

            const existingItem = cart.find(item => item.title === title);

            if (existingItem) {
                existingItem.quantity++;
            } else {
                cart.push({
                    title: title,
                    price: price,
                    image: imageSrc,
                    quantity: 1
                });
            }

            updateCartUI();
            openCart(); // Open cart to show the added item
        });
    });

    function updateCartUI() {
        // Update Count
        const totalItems = cart.reduce((acc, item) => acc + item.quantity, 0);
        cartCountElement.textContent = totalItems;

        // Update Total Price
        const totalPrice = cart.reduce((acc, item) => acc + (item.price * item.quantity), 0);
        cartTotalElement.textContent = `S/ ${totalPrice.toFixed(2)}`;

        // Render Items
        cartItemsContainer.innerHTML = '';

        if (cart.length === 0) {
            cartItemsContainer.innerHTML = `
                <div class="empty-cart-msg">
                    <i class="fa-solid fa-basket-shopping"></i>
                    <p>Tu carrito está vacío</p>
                </div>
            `;
            return;
        }

        cart.forEach((item, index) => {
            const cartItem = document.createElement('div');
            cartItem.classList.add('cart-item');
            cartItem.innerHTML = `
                <img src="${item.image}" alt="${item.title}">
                <div class="cart-item-details">
                    <h4>${item.title}</h4>
                    <div class="cart-item-price">S/ ${item.price.toFixed(2)} x ${item.quantity}</div>
                    <button class="cart-item-remove" data-index="${index}">Eliminar</button>
                </div>
            `;
            cartItemsContainer.appendChild(cartItem);
        });

        // Add Event Listeners to Remove Buttons
        document.querySelectorAll('.cart-item-remove').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const index = parseInt(e.target.getAttribute('data-index'));
                removeFromCart(index);
            });
        });
    }

    function removeFromCart(index) {
        cart.splice(index, 1);
        updateCartUI();
    }

    // Header Scroll Effect
    const header = document.querySelector('.header');
    window.addEventListener('scroll', () => {
        if (window.scrollY > 50) {
            header.style.boxShadow = '0 4px 15px rgba(0,0,0,0.1)';
            header.style.padding = '10px 0';
        } else {
            header.style.boxShadow = '0 4px 6px rgba(0,0,0,0.1)';
            header.style.padding = '15px 0';
        }
    });
    // Checkout Logic
    const checkoutBtn = document.querySelector('.checkout-btn');
    const checkoutOverlay = document.querySelector('.checkout-overlay');
    const closeCheckoutBtn = document.querySelector('.close-checkout');
    const checkoutForm = document.querySelector('#checkout-form');
    const checkoutTotalElement = document.querySelector('.checkout-total-amount');

    checkoutBtn.addEventListener('click', () => {
        if (cart.length === 0) {
            alert('Tu carrito está vacío');
            return;
        }
        closeCart();
        openCheckout();
    });

    closeCheckoutBtn.addEventListener('click', closeCheckout);
    checkoutOverlay.addEventListener('click', (e) => {
        if (e.target === checkoutOverlay) {
            closeCheckout();
        }
    });

    function openCheckout() {
        // Update total in checkout
        const totalPrice = cart.reduce((acc, item) => acc + (item.price * item.quantity), 0);
        checkoutTotalElement.textContent = `S/ ${totalPrice.toFixed(2)}`;

        checkoutOverlay.classList.add('active');
    }

    function closeCheckout() {
        checkoutOverlay.classList.remove('active');
    }

    checkoutForm.addEventListener('submit', (e) => {
        e.preventDefault();

        // Simulate Payment Processing
        const payBtn = document.querySelector('.pay-btn');
        const originalText = payBtn.textContent;

        payBtn.textContent = 'Procesando...';
        payBtn.disabled = true;

        setTimeout(() => {
            payBtn.textContent = '¡Pago Exitoso!';
            payBtn.style.backgroundColor = '#25D366'; // WhatsApp Green or Success Green

            setTimeout(() => {
                alert('¡Gracias por tu compra! Te enviaremos un correo con los detalles.');
                cart = [];
                updateCartUI();
                closeCheckout();
                checkoutForm.reset();

                payBtn.textContent = originalText;
                payBtn.disabled = false;
                payBtn.style.backgroundColor = '';
            }, 1000);
        }, 2000);
    });
});
