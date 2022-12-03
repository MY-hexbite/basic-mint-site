document.addEventListener("DOMContentLoaded", function () {
    const minusButton = document.getElementById("mint-minus");
    const plusButton = document.getElementById("mint-plus");
    const mintAmount = document.getElementById("quantity");

    minusButton.addEventListener("click", function () {
      try {
        if (+mintAmount.value > 1) {
          return +mintAmount.value--;
        }
      } catch (error) {
        alert(error);
      }
    });

    plusButton.addEventListener("click", function () {
      try {
        if (+mintAmount.value < maxPerPurchase) {
          return +mintAmount.value++;
        }
      } catch (error) {
        alert(error);
      }
    });
  });
